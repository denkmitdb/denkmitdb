import { CID } from "multiformats/cid";
import { Leaf, LeafKind } from "../protocol/tree.js";

export function createLeaf(): Leaf;
export function createLeaf(type: LeafKind.Empty): Leaf;
export function createLeaf(type: LeafKind.Hash, data: Uint8Array): Leaf;
export function createLeaf(type: LeafKind.Pollard, data: CID): Leaf;
export function createLeaf(type: LeafKind.Entry, data: CID, creator: CID): Leaf;
export function createLeaf(type: LeafKind.Identity, data: CID): Leaf;
export function createLeaf(type: LeafKind.SortedEntry, data: CID, creator: CID, sort: number[], key: string): Leaf;
export function createLeaf(
    type?: LeafKind,
    data?: Uint8Array | CID,
    creator?: CID,
    sort?: number[],
    key?: string,
): Leaf {
    switch (type) {
        case undefined:
        case LeafKind.Empty:
            return { type: LeafKind.Empty };
        case LeafKind.Hash:
            return { type: LeafKind.Hash, hash: data as Uint8Array };
        case LeafKind.Pollard:
            return { type: LeafKind.Pollard, link: data as CID };
        case LeafKind.Entry:
            return { type: LeafKind.Entry, link: data as CID, creator: creator as CID };
        case LeafKind.Identity:
            return { type: LeafKind.Identity, link: data as CID };
        case LeafKind.SortedEntry:
            return {
                type: LeafKind.SortedEntry,
                link: data as CID,
                sort: sort as number[],
                key: key as string,
                creator: creator as CID,
            };
        default:
            throw new Error("Invalid leaf type");
    }
}

export function isLeavesEqual(leaf1: Leaf, leaf2: Leaf): boolean {
    if (leaf1.type !== leaf2.type) return false;

    if (leaf1.type == LeafKind.Empty && leaf2.type == LeafKind.Empty) return true;

    if (leaf1.type == LeafKind.Hash && leaf2.type == LeafKind.Hash) return bytesEqual(leaf1.hash, leaf2.hash);

    // SortedEntry leaves must match on all metadata, not just the link — otherwise
    // tree comparison hides differing/forged key/sort/creator (KNOWN_ISSUES.md #12).
    if (leaf1.type == LeafKind.SortedEntry && leaf2.type == LeafKind.SortedEntry) {
        return (
            bytesEqual(leaf1.link.bytes, leaf2.link.bytes) &&
            bytesEqual(leaf1.creator.bytes, leaf2.creator.bytes) &&
            leaf1.key === leaf2.key &&
            leaf1.sort.length === leaf2.sort.length &&
            leaf1.sort.every((value, index) => value === leaf2.sort[index])
        );
    }

    if (
        (leaf1.type == LeafKind.Pollard && leaf2.type == LeafKind.Pollard) ||
        (leaf1.type == LeafKind.Entry && leaf2.type == LeafKind.Entry) ||
        (leaf1.type == LeafKind.Identity && leaf2.type == LeafKind.Identity)
    )
        return bytesEqual(leaf1.link.bytes, leaf2.link.bytes);

    return false;
}

function bytesEqual(bytes1: Uint8Array, bytes2: Uint8Array): boolean {
    if (bytes1.length !== bytes2.length) return false;
    return bytes1.every((byte, index) => byte === bytes2[index]);
}
