import { FloodSub } from "@libp2p/floodsub";
import { Identify } from "@libp2p/identify";
import { Libp2p } from "@libp2p/interface";
import { Helia } from "helia";
import { CID } from "multiformats/cid";
import { IdentityInterface } from "./identity.js";
import { Datastore } from "interface-datastore";

export enum DataTypes {
    Entry = 0,
    Pollard = 1,
    Identity = 2,
    Manifest = 3,
    Head = 4,
}

export type DataType = {
    dataType: DataTypes;
};

export type DenkmitLibp2pType = Libp2p<{
    identify: Identify;
    pubsub: FloodSub;
}>;

export type DenkmitHeliaInterface = Helia<DenkmitLibp2pType>;

export type SortedItemType = {
    readonly sortField: number;
    readonly cid: CID;
    readonly key: string;
    readonly creator: CID;
    readonly index: number;
    /** True when the record is a tombstone (the key is deleted). */
    readonly deleted?: boolean;
};

/**
 * Outcome of {@link SortedItemsStoreInterface.set}. `applied` is true when the
 * record became the live record for its key (last-write-wins). When it displaced
 * an earlier record, `previousTimestamp` is that record's timestamp, so the tree
 * can be rebuilt from the earlier of the two positions.
 */
export type SetResult = {
    readonly applied: boolean;
    readonly previousTimestamp?: number;
};

export interface SortedItemsStoreInterface {
    readonly size: number;

    set(sortField: number, key: string, cid: CID, creator: CID, deleted?: boolean): Promise<SetResult>;
    getByKey(key: string): Promise<SortedItemType | undefined>;
    getByIndex(index: number): Promise<SortedItemType>;
    iterator(): AsyncGenerator<SortedItemType>;
    iteratorFromIndex(startIndex: number): AsyncGenerator<SortedItemType>;
    find(sortField: number): Promise<SortedItemType>;
    clear(): Promise<void>;
}

export interface HeliaStorageInterface {
    readonly helia: DenkmitHeliaInterface;
    readonly datastore: Datastore;
    readonly libp2p: DenkmitLibp2pType;

    add(data: unknown): Promise<CID>;
    get<T>(cid: CID): Promise<T | undefined>;
    pin(cid: CID): Promise<void>;
    close(): Promise<void>;
}

export interface HeliaControllerInterface extends HeliaStorageInterface {
    identity: IdentityInterface;

    addSigned<T>(data: T): Promise<DenkmitData<T>>;
    getSigned<T>(cid: CID): Promise<DenkmitData<T> | undefined>;
}

export type DenkmitData<T> = {
    cid: CID;
    creator: CID;
    link?: CID;
    data: T;
};

export interface DenkmitDataInterface<T> extends DenkmitData<T> {
    toJSON(): T;
}

export type DenkmitMetadata = {
    readonly cid: CID; // The CID of signed data
    readonly creator: CID; // The CID of the creator
    readonly link?: CID; // The CID of the linked raw data
};
