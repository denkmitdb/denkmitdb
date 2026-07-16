import { DenkmitMetadata } from "./utils.js";

export const ENTRY_VERSION = 1;

export type EntryVersionType = typeof ENTRY_VERSION;

export type EntryData<T> = {
    readonly version: EntryVersionType;
    readonly timestamp: number;
    readonly key: string;
    readonly value: T;
};

export type EntryType<T> = EntryData<T> & DenkmitMetadata;

export interface EntryInterface<T> extends EntryType<T> {
    toJSON(): EntryData<T>;
}

