import { CID } from "multiformats/cid";
import { DenkmitMetadata } from "./utils.js";

/**
 * Current entry format. v2 entries carry the address (manifest CID) of the
 * database they were written to, inside the signed payload, so an entry cannot be
 * replayed into another database that shares a writer (KNOWN_ISSUES.md #24).
 */
export const ENTRY_VERSION = 2;

/**
 * The 3.0.0 entry format: no database binding. Accepted only by legacy (v1
 * manifest) databases, so data written by 3.0.0 stays readable.
 */
export const LEGACY_ENTRY_VERSION = 1;

export type EntryVersionType = typeof ENTRY_VERSION | typeof LEGACY_ENTRY_VERSION;

/** A put: the key holds `value`. */
export type PutEntryData<T> = {
    readonly version: EntryVersionType;
    /** Database address the entry is bound to. Required from v2; absent in v1. */
    readonly manifest?: CID;
    readonly timestamp: number;
    readonly key: string;
    readonly value: T;
};

/**
 * A tombstone: the key is deleted (specs/ordering.md — deletes participate in the
 * same composite LWW order; a winning tombstone hides the key, a newer put
 * resurrects it; the tombstone record remains in the Merkle tree).
 */
export type TombstoneEntryData = {
    readonly version: EntryVersionType;
    /** Database address the entry is bound to. Required from v2; absent in v1. */
    readonly manifest?: CID;
    readonly timestamp: number;
    readonly key: string;
    readonly deleted: true;
};

export type EntryData<T> = PutEntryData<T> | TombstoneEntryData;

export type EntryType<T> = EntryData<T> & DenkmitMetadata;

export interface EntryInterface<T> {
    readonly version: EntryVersionType;
    /** Database the entry is bound to (v2+); undefined for legacy v1 entries. */
    readonly manifest?: CID;
    readonly timestamp: number;
    readonly key: string;
    /** Present for puts; undefined for tombstones. */
    readonly value?: T;
    /** True for tombstones. */
    readonly deleted?: boolean;
    readonly cid: DenkmitMetadata["cid"];
    readonly creator: DenkmitMetadata["creator"];
    readonly link?: DenkmitMetadata["link"];
    toJSON(): EntryData<T>;
}
