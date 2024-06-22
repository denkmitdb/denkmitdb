import { CID } from "multiformats/cid";
import { Optional } from "utility-types";
import { LeafType, LeafTypes } from "./leaf";

export type PollardLocation = {
    layerIndex: number;
    position: number;
};

export const POLLARD_VERSION = 1;
export type PollardVersionType = typeof POLLARD_VERSION;

export type PollardType = {
    readonly version: PollardVersionType;
    readonly order: number;
    readonly maxLength: number;
    readonly length: number;
    readonly layers: LeafType[][];
    readonly cid: CID;
};

export type PollardInput = Optional<Omit<PollardType, "version" | "maxLength">, "cid">;

export interface PollardInterface extends PollardType {
    append(): Promise<boolean>;
    append(type: LeafTypes.Empty): Promise<boolean>;
    append(type: LeafTypes.Hash, data: Uint8Array): Promise<boolean>;
    append(type: LeafTypes.Pollard, data: CID): Promise<boolean>;
    append(type: LeafTypes.Identity, data: CID): Promise<boolean>;
    append(type: LeafTypes.Entry, data: CID, creator: CID): Promise<boolean>;
    append(type: LeafTypes.SortedEntry, data: CID, creator: CID, sort: number[], key: string): Promise<boolean>;
    
    getCID(): Promise<CID>;
    getRoot(): Promise<LeafType>;
    toJSON(): Omit<PollardType, "cid">;
    iterator(): Generator<LeafType>;
    all(): LeafType[];
    isFree(): boolean;

    getNode(layer: number, index: number): Promise<LeafType>;

    compare(other?: PollardInterface): Promise<{ isEqual: boolean; difference: [LeafType[], LeafType[]] }>;

    addLeaf(leaf: LeafType): boolean;
    getLeaf(index: number): LeafType;
    updateLayers(startPosition?: number): Promise<CID>;
    getLayers(): Promise<LeafType[][]>;
}

export type PollardNode = PollardLocation & {
    pollard?: PollardInterface;
};

export declare function createEmptyPollard(order: number): Promise<PollardInterface>;


export type PollardOptions = {
    cid?: CID;
    noUpdate?: boolean;
    hashFunc?: (data: Uint8Array) => Promise<Uint8Array>;
};

export declare function createPollard(pollard: Partial<PollardType>, options?: PollardOptions): Promise<PollardInterface>;
