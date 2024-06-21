import { GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import { Identify } from "@libp2p/identify";
import { Libp2p, PubSub } from "@libp2p/interface";
import { HeliaLibp2p } from "helia";
import { CID } from "multiformats/cid";
import { IdentityInterface } from "./identity";
import { Datastore } from "interface-datastore";

export enum DataTypes {
	Entry = 0,
	Pollard = 1,
	Identity = 2,
	Manifest = 3,
	Head = 4
}

export type DataType = {
	dataType: DataTypes;
};


export type DenkmitLibp2pType = Libp2p<{
	identify: Identify;
	pubsub: PubSub<GossipsubEvents>;
}>;

export type DenkmitHeliaInterface = HeliaLibp2p<DenkmitLibp2pType>


export type OwnedDataType<T> = {
	data?: Omit<T, "cid">;
	identity?: IdentityInterface;
};

export type SortedItemType = {
	readonly sortField: number;
	readonly cid: CID;
	readonly key: string;
	readonly index: number;
};

export interface SortedItemsStoreInterface {
	readonly size: number;

	set(sortField: number, key: string, cid: CID): Promise<void>;
	getByKey(key: string): Promise<SortedItemType | undefined>;
	getByIndex(index: number): Promise<SortedItemType>;
	iterator(): AsyncGenerator<SortedItemType>;
	iteratorFrom(sortField: number): AsyncGenerator<SortedItemType>;
	find(sortField: number): Promise<SortedItemType>;
	findPrevious(sortField: number): Promise<SortedItemType>;
	clear(): Promise<void>;
}

export interface HeliaStorageInterface {
	readonly helia: DenkmitHeliaInterface;
	readonly datastore: Datastore;
	readonly libp2p: DenkmitLibp2pType;

	add(data: unknown): Promise<CID>;
	get<T>(cid: CID): Promise<T | undefined>;
	close(): Promise<void>;
}

export interface HeliaControllerInterface extends HeliaStorageInterface {
	identity: IdentityInterface;

	addSigned<T>(data: OwnedDataType<T>): Promise<CID>;
    addSignedV2<T>(data: T): Promise<DenkmitData<T>>;
	getSigned<T>(cid: CID): Promise<OwnedDataType<T> | undefined>;
    getSignedV2<T>(cid: CID): Promise<DenkmitData<T> | undefined>;
}

export type DenkmitData<T> = {
    cid: CID;
    creator: CID;
    link?: CID;
    data: T;
}

export interface DenkmitDataInterface<T> extends DenkmitData<T> {
    toJSON(): T;
}

export type DenkmitMetadata = {
    readonly cid: CID;      // The CID of signed data
    readonly creator: CID;  // The CID of the creator
    readonly link?: CID;     // The CID of the linked raw data
}
