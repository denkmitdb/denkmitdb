import Keyv from "keyv";
import { CID } from "multiformats/cid";
import {
    LeafType,
    PollardInterface,
    HeliaControllerInterface,
    SyncControllerInterface,
    DenkmitHeliaInterface,
    HeadInterface,
    IdentityInterface,
    ManifestInterface,
    PolicyInterface,
} from "./index.js";

export const DENKMITDB_PREFIX = "/denkmitdb/";

export type DenkmitDatabaseType<T> = {
    readonly manifest: ManifestInterface;
    readonly order: number;
    readonly maxPollardLength: number;
    readonly layers: PollardInterface[][];
    readonly heliaController: HeliaControllerInterface;
    readonly identity: IdentityInterface;
    readonly keyValueStorage: Keyv<T>;
    readonly address: CID;
};

export type DenkmitDatabaseInput<T> = {
    manifest: ManifestInterface;
    heliaController: HeliaControllerInterface;
    identity: IdentityInterface;
    keyValueStorage?: Keyv<T>;
    syncController: SyncControllerInterface;
    validationPolicy: PolicyInterface;
    accessPolicy: PolicyInterface;
};

/**
 * Represents the interface for the Denkmit database.
 * @typeParam T - The type of values stored in the database.
 */
export interface DenkmitDatabaseInterface<T> extends DenkmitDatabaseType<T> {
    /**
     * Sets a value in the database with the specified key.
     * @param key - The key to set the value for.
     * @param value - The value to set.
     * @returns A promise that resolves when the value is set.
     */
    set(key: string, value: T): Promise<void>;

    /**
     * Retrieves the value associated with the specified key from the database.
     * @param key - The key to retrieve the value for.
     * @returns A promise that resolves with the retrieved value, or undefined if the key does not exist.
     */
    get(key: string): Promise<T | undefined>;

    /**
     * Deletes a key by writing a signed tombstone. The tombstone participates in
     * the same last-write-wins order as puts: while it wins, the key is hidden from
     * `get`/`iterator`; a newer `set` resurrects it. The record remains in the
     * Merkle tree and replicates like any entry.
     * @param key - The key to delete.
     * @returns A promise that resolves when the tombstone is indexed.
     */
    delete(key: string): Promise<void>;

    /**
     * Returns the provenance of the current record for a key — signed entry CID,
     * writer identity CID, timestamp, and tombstone flag — or undefined if the key
     * has never been written.
     * @param key - The key to inspect.
     */
    provenance(key: string): Promise<{ cid: CID; creator: CID; timestamp: number; deleted: boolean } | undefined>;

    /**
     * Closes the database connection.
     * @returns A promise that resolves when the connection is closed.
     */
    close(): Promise<void>;

    /**
     * Returns an async generator that iterates over all key-value pairs in the database.
     * @returns An async generator that yields key-value pairs.
     */
    iterator(): AsyncGenerator<[key: string, value: T]>;

    /**
     * Retrieves the manifest associated with the database.
     * @returns A promise that resolves with the manifest.
     */
    getManifest(): Promise<ManifestInterface>;

    /**
     * Creates a new head for the database.
     * @returns A promise that resolves with the newly created head.
     */
    createHead(): Promise<HeadInterface>;

    /**
     * Fetches the head with the specified CID (Content Identifier) from the database.
     * @param cid - The CID of the head to fetch.
     * @returns A promise that resolves with the fetched head.
     */
    fetchHead(cid: CID): Promise<HeadInterface>;

    /**
     * Loads the specified head into the database.
     * @param head - The head to load.
     * @returns A promise that resolves when the head is loaded.
     */
    load(head: HeadInterface): Promise<void>;

    /**
     * Compares the specified head with the current head in the database.
     * @param head - The head to compare.
     * @returns A promise that resolves with an object containing the comparison result.
     */
    compare(head: HeadInterface): Promise<{ isEqual: boolean; difference: [LeafType[], LeafType[]] }>;

    /**
     * Merges the specified head into the current head in the database.
     * @param head - The head to merge.
     * @returns A promise that resolves when the merge is complete.
     */
    merge(head: HeadInterface): Promise<void>;

    /**
     * The number of records currently in the sorted index.
     */
    readonly size: number;

    /**
     * Publishes the current head (if the root changed) on the sync topic.
     * @returns A promise that resolves once the head has been handed to the sync controller.
     */
    sendHead(): Promise<void>;

    /**
     * Re-announces the current head on the sync topic even when the root has not
     * changed, so peers that connected after the last change can converge.
     * @returns A promise that resolves once the head (if any) has been published.
     */
    announceHead(): Promise<void>;

    /**
     * Resolves once queued background work (tree rebuilds, merges) has drained.
     * @returns A promise that resolves when the sync task queue is idle.
     */
    idle(): Promise<void>;

    /**
     * Handles an incoming head announcement (the encoded CID of a peer's head),
     * queuing a load or merge of that head into this database.
     * @param data - The encoded CID bytes received on the sync topic.
     * @returns A promise that resolves once the task has been enqueued.
     */
    syncNewHead(data: Uint8Array): Promise<void>;
}

export type DenkmitDatabaseOptions<T> = {
    helia: DenkmitHeliaInterface;
    identity: IdentityInterface;
    keyValueStorage?: Keyv<T>;
    /**
     * Pollard order for new databases: each Merkle subtree holds 2^order leaves.
     * Integer in [1, 8]; default 3. Create only — open always uses the value from
     * the signed manifest (it defines the tree shape every replica must agree on).
     */
    order?: number;
    syncController?: SyncControllerInterface;
    /**
     * Access policy for new databases (create only; open reads the manifest).
     * Default is **creator-only** — only the identity that created the database may
     * write. Set `publicWrite: true` to opt into a world-writable database.
     */
    publicWrite?: boolean;
};

