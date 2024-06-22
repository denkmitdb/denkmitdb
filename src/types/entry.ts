import { HeliaController } from "src/functions";
import { CID } from "multiformats/cid";
import { DenkmitMetadata } from "./utils";

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

export declare function addEntry<T>(key: string, value: T, heliaController: HeliaController): Promise<EntryType<T>>;
export declare function getEntry<T>(cid: CID, heliaController: HeliaController): Promise<EntryType<T>>;
