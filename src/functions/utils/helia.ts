import { DAGCBOR, dagCbor } from "@helia/dag-cbor";
import * as codec from "@ipld/dag-cbor";
import drain from "it-drain";
import * as jose from "jose";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import {
    DenkmitData,
    DenkmitHeliaInterface,
    HeliaControllerInterface,
    HeliaStorageInterface,
    IdentityInterface,
} from "../../types/index.js";
import { TimeoutController } from "timeout-abort-controller";
import { fetchIdentity } from "../identity.js";

const DefaultTimeout = 30000; // 30 seconds

/**
 * Represents a Storage for interacting with the Helia IPFS.
 */
export class HeliaStorage implements HeliaStorageInterface {
    readonly helia: DenkmitHeliaInterface;
    private heliaDagCbor: DAGCBOR;

    /**
     * Creates a new instance of the HeliaStorage class.
     * @param helia - The Helia database interface.
     */
    constructor(helia: DenkmitHeliaInterface) {
        this.helia = helia;
        this.heliaDagCbor = dagCbor(helia);
    }

    /**
     * Encodes the given data into a Uint8Array.
     *
     * @param data - The data to be encoded.
     * @returns The encoded data as a Uint8Array.
     */
    static encode<T>(data: T): Uint8Array {
        return codec.encode<T>(data);
    }

    /**
     * Decodes the given Uint8Array data using the specified codec.
     *
     * @typeParam T - The type of the decoded data.
     * @param data - The data to be decoded.
     * @returns The decoded data.
     */
    static decode<T>(data: Uint8Array): T {
        return codec.decode<T>(data);
    }

    static get code(): number {
        return codec.code;
    }

    /**
     * Gets the datastore.
     * @returns The datastore.
     */
    get datastore() {
        return this.helia.datastore;
    }

    /**
     * Gets the blockstore.
     * @returns The blockstore.
     */
    get blockstore() {
        return this.helia.blockstore;
    }

    /**
     * Gets the libp2p instance.
     * @returns The libp2p instance.
     */
    get libp2p() {
        return this.helia.libp2p;
    }

    /**
     * Gets the logger instance.
     * @returns The logger instance.
     */
    get logger() {
        return this.helia.logger;
    }

    /**
     * Adds an object to the Helia database.
     * @param data - The object to add.
     * @returns A Promise that resolves to the CID of the added object.
     */
    async add(data: unknown): Promise<CID> {
        const controller = new TimeoutController(DefaultTimeout);
        try {
            const cid = await this.heliaDagCbor.add(data, { signal: controller.signal });
            if (!(await this.helia.pins.isPinned(cid))) {
                await drain(this.helia.pins.add(cid));
            }
            return cid;
        } finally {
            controller.clear();
        }
    }

    /**
     * Pins a block so Helia garbage collection cannot drop it. Used for foreign
     * blocks (entries, identities) accepted during merge — they were fetched, not
     * added, so they are unpinned by default and a locally persisted head would not
     * survive GC without this (KNOWN_ISSUES.md D4).
     * @param cid - The CID of the block to pin.
     */
    async pin(cid: CID): Promise<void> {
        if (!(await this.helia.pins.isPinned(cid))) {
            await drain(this.helia.pins.add(cid));
        }
    }

    /**
     * Retrieves an object from the Helia database.
     * @param cid - The CID of the object to retrieve.
     * @returns A Promise that resolves to the retrieved object, or undefined if not found.
     */
    async get<T>(cid: CID): Promise<T | undefined> {
        const controller = new TimeoutController(DefaultTimeout);
        try {
            return await this.heliaDagCbor.get<T>(cid, { signal: controller.signal });
        } finally {
            controller.clear();
        }
    }

    /**
     * Closes the HeliaStorage instance.
     * @returns A Promise that resolves when the controller is closed.
     */
    async close(): Promise<void> {
        await this.helia.stop();
    }
}

/**
 * Represents a controller for interacting with the Helia storage, providing methods for adding and retrieving signed data.
 */
export class HeliaController extends HeliaStorage implements HeliaControllerInterface {
    readonly identity: IdentityInterface;

    // Bounded, insertion-ordered LRU of resolved identities keyed by CID string.
    // Stores the in-flight promise so concurrent lookups of the same identity
    // coalesce onto one fetch (KNOWN_ISSUES.md D6).
    private static readonly IDENTITY_CACHE_MAX = 1024;
    private readonly identityCache = new Map<string, Promise<IdentityInterface>>();
    // Number of actual fetchIdentity() calls (cache misses) — observability for the
    // merge hot-path and tests.
    private identityFetches = 0;

    constructor(helia: DenkmitHeliaInterface, identity: IdentityInterface) {
        super(helia);
        this.identity = identity;
    }

    /** Count of identities actually fetched+verified (cache misses). */
    get identityFetchCount(): number {
        return this.identityFetches;
    }

    /**
     * Resolves the identity for a signer CID, caching successful results. The local
     * identity short-circuits (no fetch). Failures are not cached — a transient miss
     * must not become permanent (KNOWN_ISSUES.md D6).
     */
    private async resolveIdentity(cid: CID): Promise<IdentityInterface> {
        const key = cid.toString();
        if (this.identity.cid.toString() === key) return this.identity;

        const cached = this.identityCache.get(key);
        if (cached) {
            // Refresh LRU recency.
            this.identityCache.delete(key);
            this.identityCache.set(key, cached);
            return cached;
        }

        this.identityFetches++;
        const promise = fetchIdentity(cid, this)
            .then(async (identity) => {
                // Keep verified foreign identities across restarts/GC (D4).
                await this.pin(cid);
                return identity;
            })
            .catch((error) => {
                this.identityCache.delete(key);
                throw error;
            });
        this.identityCache.set(key, promise);

        if (this.identityCache.size > HeliaController.IDENTITY_CACHE_MAX) {
            const oldest = this.identityCache.keys().next().value;
            if (oldest !== undefined) this.identityCache.delete(oldest);
        }

        return promise;
    }

    /**
     * Signs `data` with the local identity and stores the JWS as a dag-cbor block.
     *
     * @param data - The payload to sign and store.
     * @returns The stored payload with its CID and the signer's identity CID.
     */
    async addSigned<T>(data: T): Promise<DenkmitData<T>> {
        const signed = await this.identity.sign(codec.encode(data));
        const cid = await this.add(signed);

        return { data, cid, creator: this.identity.cid };
    }

    /**
     * Fetches a JWS block, resolves and verifies the signer's identity (cached),
     * and returns the decoded payload with its provenance.
     *
     * @typeParam T - The type of the decoded payload.
     * @param cid - The CID of the signed block.
     * @returns The payload with CID and creator, or undefined if missing or invalid.
     */
    async getSigned<T>(cid: CID): Promise<DenkmitData<T> | undefined> {
        const signed = await this.get<jose.FlattenedJWS>(cid);
        if (!signed) return;

        const protectedHeader = jose.decodeProtectedHeader(signed);
        const kid = protectedHeader.kid;
        if (!kid) return;
        const kidCid = CID.parse(kid);

        const identity = await this.resolveIdentity(kidCid);

        const verified = await identity.verify(signed);
        const data = verified && (HeliaStorage.decode(verified) as T);

        if (!data) return;
        return { data, cid, creator: identity.cid };
    }
}

export async function emptyCID(): Promise<CID> {
    const bytes = HeliaStorage.encode({});
    const hash = await sha256.digest(bytes);
    return CID.create(1, HeliaStorage.code, hash);
}
