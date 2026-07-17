import { ENTRY_VERSION, EntryInterface, EntryData, HeliaControllerInterface, DenkmitData } from "../types/index.js";
import { CID } from "multiformats/cid";
import { logger } from "@libp2p/logger";

const log = logger("denkmit:entry");

export class Entry<T> implements EntryInterface<T> {
    readonly version = ENTRY_VERSION;
    readonly timestamp: number;
    readonly key: string;
    readonly value?: T;
    readonly deleted?: boolean;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    constructor(entry: DenkmitData<EntryData<T>>) {
        this.timestamp = entry.data.timestamp;
        this.key = entry.data.key;
        if ("deleted" in entry.data && entry.data.deleted === true) {
            this.deleted = true;
        } else if ("value" in entry.data) {
            this.value = entry.data.value;
        }

        this.cid = entry.cid;
        this.creator = entry.creator;
        this.link = entry.link;

        log("Created entry:", this);
    }

    toJSON(): EntryData<T> {
        // dag-cbor rejects undefined fields, so emit exactly one shape per variant.
        if (this.deleted) {
            return { version: this.version, timestamp: this.timestamp, key: this.key, deleted: true };
        }
        return { version: this.version, timestamp: this.timestamp, key: this.key, value: this.value as T };
    }
}

/**
 * Creates a new entry with the specified key and value.
 *
 * @typeParam T - The type of the value.
 * @param key - The key of the entry.
 * @param value - The value of the entry.
 * @param heliaController - The Helia controller interface.
 * @returns A promise that resolves to the created entry.
 */
export async function createEntry<T>(
    key: string,
    value: T,
    heliaController: HeliaControllerInterface,
): Promise<EntryInterface<T>> {
    log("Creating entry with key, value:", { key, value });
    const data: EntryData<T> = {
        version: ENTRY_VERSION,
        timestamp: Date.now(),
        key,
        value,
    };

    const result = await heliaController.addSignedV2(data);
    return new Entry(result);
}

/**
 * Creates a signed tombstone for the specified key: a delete record that
 * participates in the same composite last-write-wins order as puts. A winning
 * tombstone hides the key; a newer put resurrects it (specs/ordering.md).
 *
 * @param key - The key to delete.
 * @param heliaController - The Helia controller interface.
 * @returns A promise that resolves to the created tombstone entry.
 */
export async function createTombstone<T>(
    key: string,
    heliaController: HeliaControllerInterface,
): Promise<EntryInterface<T>> {
    log("Creating tombstone for key:", { key });
    const data: EntryData<T> = {
        version: ENTRY_VERSION,
        timestamp: Date.now(),
        key,
        deleted: true,
    };

    const result = await heliaController.addSignedV2(data);
    return new Entry(result);
}

/**
 * Fetches an entry from the database based on the given CID.
 *
 * @typeParam T - The type of the entry data.
 * @param cid - The CID of the entry to fetch.
 * @param heliaController - The Helia controller instance.
 * @returns - A promise that resolves to the fetched entry.
 * @throws {ReferenceError} - If the entry is not found or the entry data is not found.
 */
export async function fetchEntry<T>(cid: CID, heliaController: HeliaControllerInterface): Promise<EntryInterface<T>> {
    log("Fetching entry with CID: ", cid);
    const result = await heliaController.getSignedV2<EntryData<T>>(cid);
    if (!result) throw new ReferenceError("Entry not found");
    if (!result.data) throw new ReferenceError("Entry data not found");

    return new Entry(result);
}
