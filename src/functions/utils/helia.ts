import { DAGCBOR, dagCbor } from "@helia/dag-cbor";
import * as codec from "@ipld/dag-cbor";
import drain from "it-drain";
import * as jose from "jose";
import { CID } from "multiformats/cid";
import { sha256 } from 'multiformats/hashes/sha2';
import { DenkmitData, DenkmitHeliaInterface, HeliaControllerInterface, HeliaStorageInterface, IdentityInterface, OwnedDataType } from "../../types";
import { TimeoutController } from "timeout-abort-controller";
import { fetchIdentity } from "../identity";

const DefaultTimeout = 30000 // 30 seconds

/**
 * Represents a Storage for interacting with the Helia IPFS.
 */
export class HeliaStorage implements HeliaStorageInterface {
    readonly helia: DenkmitHeliaInterface;
    private heliaDagCbor: DAGCBOR;

    /**
     * Creates a new instance of the HeliaStorage class.
     * @param helia The Helia database interface.
     * @param identity The identity interface for signing and verifying data.
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
     * @template T - The type of the decoded data.
     * @param {Uint8Array} data - The data to be decoded.
     * @returns {T} - The decoded data.
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
     * Adds an object to the Helia database.
     * @param obj The object to add.
     * @returns A Promise that resolves to the CID of the added object.
     */
    async add(data: unknown): Promise<CID> {
        const { signal } = new TimeoutController(DefaultTimeout)
        const cid = await this.heliaDagCbor.add(data, { signal });
        if (!(await this.helia.pins.isPinned(cid))) {
            await drain(this.helia.pins.add(cid));
        }

        return cid;
    }

    async addBytes(buf: Uint8Array): Promise<CID> {
        const hash = await sha256.digest(buf)
        const cid = CID.createV1(codec.code, hash)
        const { signal } = new TimeoutController(DefaultTimeout)
        await this.helia.blockstore.put(cid, buf, { signal })
        if (!(await this.helia.pins.isPinned(cid))) {
            await drain(this.helia.pins.add(cid));
        }

        return cid;
    }

    /**
     * Retrieves an object from the Helia database.
     * @param cid The CID of the object to retrieve.
     * @returns A Promise that resolves to the retrieved object, or undefined if not found.
     */
    async get<T>(cid: CID): Promise<T | undefined> {
        const { signal } = new TimeoutController(DefaultTimeout)
        return await this.heliaDagCbor.get<T>(cid, { signal });
    }

    async getBytes(cid: CID): Promise<Uint8Array | undefined> {
        const { signal } = new TimeoutController(DefaultTimeout)
        return await this.helia.blockstore.get(cid, { signal })
    }

    /**
     * Closes the HeliaStorage instance.
     * @returns A Promise that resolves when the controller is closed.
     */
    async close(): Promise<void> {
        this.helia.stop();
    }
}

type UpdatedJWS = {
    payload: CID;
    signature: string;
    protected: string;
}

/**
 * Represents a controller for interacting with the Helia storage, providing methods for adding and retrieving signed data.
 */
export class HeliaController extends HeliaStorage implements HeliaControllerInterface {
    readonly identity: IdentityInterface;

    constructor(helia: DenkmitHeliaInterface, identity: IdentityInterface) {
        super(helia);
        this.identity = identity;
    }

    async addSignedV2<T>(data: T): Promise<DenkmitData<T>> {
        const buf = codec.encode(data)
        const link = await this.addBytes(buf)
        const signed = await this.identity.signWithoutPayload(buf);
        if (!signed.protected) throw new Error("Failed to sign data")
        const updated: UpdatedJWS = { signature: signed.signature, protected: signed.protected, payload: link }

        const cid = await this.add(updated);

        return { data, cid, link, creator: this.identity.cid }
    }

    /**
     * Adds the signed data to the database.
     * 
     * @param data - The data to be added, along with the identity used for signing.
     * @returns The CID (Content Identifier) of the added data.
     * @throws Error if the identity is not provided.
     */
    async addSigned<T>(data: OwnedDataType<T>): Promise<CID> {
        if (!data.identity) throw new Error("Identity is required to sign data.");
        const signed = await data.identity.sign(codec.encode(data.data));
        return await this.add(signed);
    }

    /**
     * Retrieves a signed data object of type T from the specified CID.
     * 
     * @template T - The type of the data object.
     * @param {CID} cid - The CID of the data object.
     * @returns {Promise<OwnedDataType<T> | undefined>} - A promise that resolves to the signed data object, or undefined if it doesn't exist or fails verification.
     */
    async getSigned<T>(cid: CID): Promise<OwnedDataType<T> | undefined> {
        const signed = await this.get<jose.FlattenedJWS>(cid);
        if (!signed) return;

        const protectedHeader = jose.decodeProtectedHeader(signed);
        const kid = protectedHeader.kid;
        if (!kid) return;
        const kidCid = CID.parse(kid);

        const identity = this.identity.cid.equals(kidCid) ? this.identity : await fetchIdentity(kidCid, this);
        if (!identity) return;

        const verified = await identity.verify(signed);
        const data = verified && HeliaStorage.decode(verified) as T;
        return { identity, data };
    }

    async getSignedV2<T>(cid: CID): Promise<DenkmitData<T> | undefined> {
        const signed = await this.get<UpdatedJWS>(cid);
        if (!signed) throw new Error("Signed data not found");

        const protectedHeader = jose.decodeProtectedHeader(signed.protected);
        const kid = protectedHeader.kid;
        if (!kid) throw new Error("Key ID not found in JWS header");
        const kidCid = CID.parse(kid);

        const identity = this.identity.cid.equals(kidCid) ? this.identity : await fetchIdentity(kidCid, this);
        if (!identity) throw new Error("Identity not found");

        const payload = await this.getBytes(signed.payload);
        if (!payload) throw new Error("Payload not found");

        const jws = { payload, signature: signed.signature, protected: signed.protected }

        const verified = await identity.verify(jws);

        const data = verified && HeliaStorage.decode(verified) as T;
        if (!data) throw new Error("Data not found");

        return { data, cid, link: signed.payload, creator: identity.cid }
    }
}

export async function emptyCID(): Promise<CID> {
    const bytes = HeliaStorage.encode({})
    const hash = await sha256.digest(bytes)
    return CID.create(1, HeliaStorage.code, hash)
}

