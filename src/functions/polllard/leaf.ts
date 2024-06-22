import { CID } from "multiformats/cid";
import { LeafType, LeafTypes } from "../../types";

export function createLeaf(): LeafType;
export function createLeaf(type: LeafTypes.Empty): LeafType;
export function createLeaf(type: LeafTypes.Hash, data: Uint8Array): LeafType;
export function createLeaf(type: LeafTypes.Pollard, data: CID): LeafType;
export function createLeaf(type: LeafTypes.Entry, data: CID, creator: CID): LeafType;
export function createLeaf(type: LeafTypes.Identity, data: CID): LeafType;
export function createLeaf(type: LeafTypes.SortedEntry, data: CID, creator: CID, sort: number[], key: string): LeafType;
export function createLeaf(type?: LeafTypes, data?: Uint8Array | CID, creator?: CID, sort?: number[], key?: string): LeafType {
    switch (type) {
        case undefined:
        case LeafTypes.Empty:
            return { type: LeafTypes.Empty };
        case LeafTypes.Hash:
            return { type: LeafTypes.Hash, hash: data as Uint8Array };
        case LeafTypes.Pollard:
            return { type: LeafTypes.Pollard, link: data as CID};
        case LeafTypes.Entry:
            return { type: LeafTypes.Entry, link: data as CID, creator: creator as CID};
        case LeafTypes.Identity:
            return { type: LeafTypes.Identity, link: data as CID };
        case LeafTypes.SortedEntry:
            return { type: LeafTypes.SortedEntry, link: data as CID, sort: sort as number[], key: key as string, creator: creator as CID };
        default:
            throw new Error("Invalid leaf type");
    }
}

export function isLeavesEqual(leaf1: LeafType, leaf2: LeafType): boolean {
    if (leaf1.type !== leaf2.type) return false;

    if (leaf1.type == LeafTypes.Empty && leaf2.type == LeafTypes.Empty) return true;

    if (leaf1.type == LeafTypes.Hash && leaf2.type == LeafTypes.Hash) 
        return bytesEqual(leaf1.hash, leaf2.hash);

    if ((leaf1.type == LeafTypes.Pollard && leaf2.type == LeafTypes.Pollard) ||
        (leaf1.type == LeafTypes.Entry && leaf2.type == LeafTypes.Entry) ||
        (leaf1.type == LeafTypes.Identity && leaf2.type == LeafTypes.Identity) ||
        (leaf1.type == LeafTypes.SortedEntry && leaf2.type == LeafTypes.SortedEntry))  
        return bytesEqual(leaf1.link.bytes, leaf2.link.bytes);

    return false;
}

function bytesEqual(bytes1: Uint8Array, bytes2: Uint8Array): boolean {
    if (bytes1.length !== bytes2.length) return false;
    return bytes1.every((byte, index) => byte === bytes2[index]);
}