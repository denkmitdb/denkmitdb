import Keyv from "keyv";
import { CID } from "multiformats/cid";
import {
    LeafType,
    PollardInterface,
    HeliaControllerInterface,
    SyncControllerInterface,
    DenkmitHeliaInterface,
    SortedItemsStoreInterface,
    HeadInterface,
    IdentityInterface,
    ManifestInterface,
    ConsensusControllerInterface,
} from "../types";

export const DENKMITDB_PREFIX = "/denkmitdb/";

export type DenkmitDatabaseType<T> = {
    readonly manifest: ManifestInterface;
    readonly order: number;
    readonly maxPollardLength: number;
    readonly layers: PollardInterface[][];
    readonly heliaController: HeliaControllerInterface;
    readonly identity: IdentityInterface;
    readonly keyValueStorage: Keyv<T, Record<string, T>>;
    readonly address: CID;
};

export type DenkmitDatabaseInput<T> = {
    manifest: ManifestInterface;
    heliaController: HeliaControllerInterface;
    identity: IdentityInterface;
    keyValueStorage?: Keyv<T, Record<string, T>>;
    syncController: SyncControllerInterface;
    consensusController: ConsensusControllerInterface;
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
}

export type DenkmitDatabaseOptions<T> = {
    helia: DenkmitHeliaInterface;
    identity: IdentityInterface;
    keyValueStorage?: Keyv<T, Record<string, T>>;
    order?: number;
    syncController?: SyncControllerInterface;
    sortedItemsStore?: SortedItemsStoreInterface;
    consensusController?: ConsensusControllerInterface;
};

export declare function createDenkmitDatabase<T>(
    name: string,
    options: DenkmitDatabaseOptions<T>,
): Promise<DenkmitDatabaseInterface<T>>;
export declare function openDenkmitDatabase<T>(
    cid: CID,
    options: DenkmitDatabaseOptions<T>,
): Promise<DenkmitDatabaseInterface<T>>;
