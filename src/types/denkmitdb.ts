import Keyv from "keyv";
import { CID } from "multiformats/cid";
import { LeafType, PollardInterface, HeliaControllerInterface, SyncControllerInterface, DenkmitHeliaInterface, SortedItemsStoreInterface, HeadInterface, IdentityInterface, ManifestInterface } from "../types";

export const DENKMITDB_PREFIX = "/denkmitdb/";

export type DenkmitDatabaseType<T> = {
	readonly manifest: ManifestInterface;
	readonly order: number;
	readonly maxPollardLength: number;
	readonly layers: PollardInterface[][];
	readonly heliaController: HeliaControllerInterface;
	readonly identity: IdentityInterface;
	readonly keyValueStorage: Keyv<T, Record<string, T>>;
}

export type DenkmitDatabaseInput<T> = {
	manifest: ManifestInterface;
	heliaController: HeliaControllerInterface;
	identity: IdentityInterface;
	keyValueStorage?: Keyv<T, Record<string, T>>;
	syncController: SyncControllerInterface;
}

export interface DenkmitDatabaseInterface<T> extends DenkmitDatabaseType<T> {
	set(key: string, value: T): Promise<void>;
	get(key: string): Promise<T | undefined>;
	close(): Promise<void>;
	iterator(): AsyncGenerator<[key: string, value: T]>;

	getManifest(): Promise<ManifestInterface>;

	createHead(): Promise<HeadInterface>;
	fetchHead(cid: CID): Promise<HeadInterface>;

	load(head: HeadInterface): Promise<void>;
	compare(head: HeadInterface): Promise<{ isEqual: boolean; difference: [LeafType[], LeafType[]] }>;
	merge(head: HeadInterface): Promise<void>;
}

export type DenkmitDatabaseOptions<T> = {
	helia: DenkmitHeliaInterface;
	identity?: IdentityInterface;
	keyValueStorage?: Keyv<T, Record<string, T>>;
	order?: number;
	syncController?: SyncControllerInterface;
	sortedItemsStore?: SortedItemsStoreInterface;
}

export declare function createDenkmitDatabase<T>(name: string, options: DenkmitDatabaseOptions<T>): Promise<DenkmitDatabaseInterface<T>>;
export declare function openDenkmitDatabase<T>(id: string, options: DenkmitDatabaseOptions<T>): Promise<DenkmitDatabaseInterface<T>>;
