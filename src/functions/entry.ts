import {
    ENTRY_VERSION,
    EntryInterface,
    EntryData,
    EntryVersionType,
    HeliaControllerInterface,
    DenkmitData,
    LEGACY_ENTRY_VERSION,
} from "../types/index.js";
import { CID } from "multiformats/cid";
import { logger } from "@libp2p/logger";

const log = logger("denkmit:entry");

export class Entry<T> implements EntryInterface<T> {
    readonly version: EntryVersionType;
    readonly manifest?: CID;
    readonly timestamp: number;
    readonly key: string;
    readonly value?: T;
    readonly deleted?: boolean;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    constructor(entry: DenkmitData<EntryData<T>>) {
        // The version comes from the signed payload, never a constant: ingestion
        // decides what a legacy entry may do based on it (KNOWN_ISSUES.md #24).
        this.version = entry.data.version;
        if (entry.data.manifest) this.manifest = entry.data.manifest;
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
        const binding = this.manifest ? { manifest: this.manifest } : {};
        if (this.deleted) {
            return { version: this.version, ...binding, timestamp: this.timestamp, key: this.key, deleted: true };
        }
        return { version: this.version, ...binding, timestamp: this.timestamp, key: this.key, value: this.value as T };
    }
}

/**
 * Creates a new entry with the specified key and value.
 *
 * @typeParam T - The type of the value.
 * @param key - The key of the entry.
 * @param value - The value of the entry.
 * @param heliaController - The Helia controller interface.
 * @param manifest - The address of the database the entry is written to. Bound
 *   into the signed payload so the entry cannot be replayed into another database
 *   (KNOWN_ISSUES.md #24). Omitting it produces a legacy v1 entry, which only
 *   legacy (v1-manifest) databases accept.
 * @returns A promise that resolves to the created entry.
 */
export async function createEntry<T>(
    key: string,
    value: T,
    heliaController: HeliaControllerInterface,
    manifest?: CID,
): Promise<EntryInterface<T>> {
    log("Creating entry with key, value:", { key, value });
    const data: EntryData<T> = manifest
        ? { version: ENTRY_VERSION, manifest, timestamp: Date.now(), key, value }
        : { version: LEGACY_ENTRY_VERSION, timestamp: Date.now(), key, value };

    const result = await heliaController.addSigned(data);
    return new Entry(result);
}

/**
 * Creates a signed tombstone for the specified key: a delete record that
 * participates in the same composite last-write-wins order as puts. A winning
 * tombstone hides the key; a newer put resurrects it (specs/ordering.md).
 *
 * @param key - The key to delete.
 * @param heliaController - The Helia controller interface.
 * @param manifest - The database address to bind the tombstone to (see createEntry).
 * @returns A promise that resolves to the created tombstone entry.
 */
export async function createTombstone<T>(
    key: string,
    heliaController: HeliaControllerInterface,
    manifest?: CID,
): Promise<EntryInterface<T>> {
    log("Creating tombstone for key:", { key });
    const data: EntryData<T> = manifest
        ? { version: ENTRY_VERSION, manifest, timestamp: Date.now(), key, deleted: true }
        : { version: LEGACY_ENTRY_VERSION, timestamp: Date.now(), key, deleted: true };

    const result = await heliaController.addSigned(data);
    return new Entry(result);
}

/**
 * Checks the shape of a decoded entry payload. A valid signature only proves who
 * wrote the bytes, not that they are a well-formed entry, so every field is
 * checked before the entry is trusted for indexing (KNOWN_ISSUES.md #24).
 *
 * @param data - The decoded, signature-verified payload.
 * @throws TypeError - If the payload is not a well-formed v1 or v2 entry.
 */
export function assertEntryShape(data: unknown): asserts data is EntryData<unknown> {
    if (typeof data !== "object" || data === null) throw new TypeError("Entry is not an object");
    const entry = data as Record<string, unknown>;
    if (entry.version !== ENTRY_VERSION && entry.version !== LEGACY_ENTRY_VERSION) {
        throw new TypeError(`Unsupported entry version ${String(entry.version)}`);
    }
    if (entry.version === ENTRY_VERSION && CID.asCID(entry.manifest) === null) {
        throw new TypeError("Entry is not bound to a database");
    }
    if (entry.version === LEGACY_ENTRY_VERSION && entry.manifest !== undefined) {
        throw new TypeError("Legacy entry carries a database binding");
    }
    if (typeof entry.timestamp !== "number" || !Number.isSafeInteger(entry.timestamp) || entry.timestamp < 0) {
        throw new TypeError("Entry timestamp is not a non-negative integer");
    }
    if (typeof entry.key !== "string") throw new TypeError("Entry key is not a string");
    const isTombstone = "deleted" in entry;
    const isPut = "value" in entry;
    if (isTombstone === isPut) throw new TypeError("Entry must be exactly one of put or tombstone");
    if (isTombstone && entry.deleted !== true) throw new TypeError("Tombstone flag must be true");
}

/**
 * Fetches an entry from the database based on the given CID.
 *
 * @typeParam T - The type of the entry data.
 * @param cid - The CID of the entry to fetch.
 * @param heliaController - The Helia controller instance.
 * @returns - A promise that resolves to the fetched entry.
 * @throws ReferenceError - If the entry is not found or the entry data is not found.
 * @throws TypeError - If the signed payload is not a well-formed entry.
 */
export async function fetchEntry<T>(cid: CID, heliaController: HeliaControllerInterface): Promise<EntryInterface<T>> {
    log("Fetching entry with CID: ", cid);
    const result = await heliaController.getSigned<EntryData<T>>(cid);
    if (!result) throw new ReferenceError("Entry not found");
    if (!result.data) throw new ReferenceError("Entry data not found");
    assertEntryShape(result.data);

    return new Entry(result);
}
