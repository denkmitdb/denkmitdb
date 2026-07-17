import { DenkmitMetadata } from "./utils.js";

export const ENTRY_VERSION = 1;

export type EntryVersionType = typeof ENTRY_VERSION;

/** A put: the key holds `value`. */
export type PutEntryData<T> = {
    readonly version: EntryVersionType;
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
    readonly timestamp: number;
    readonly key: string;
    readonly deleted: true;
};

export type EntryData<T> = PutEntryData<T> | TombstoneEntryData;

export type EntryType<T> = EntryData<T> & DenkmitMetadata;

export interface EntryInterface<T> {
    readonly version: EntryVersionType;
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
