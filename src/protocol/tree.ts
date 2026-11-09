import { CID } from "multiformats/cid";

/** Pollard (tree node block) format. */
export const POLLARD_VERSION = 2;

/** Leaf kinds. Numeric on the wire — never renumber. */
export enum LeafKind {
    Empty = 0,
    Hash = 1,
    Pollard = 2,
    Entry = 3,
    Identity = 4,
    SortedEntry = 5,
}

export type EmptyLeaf = {
    type: LeafKind.Empty;
};

export type HashLeaf = {
    type: LeafKind.Hash;
    hash: Uint8Array;
};

export type PollardLeaf = {
    type: LeafKind.Pollard;
    link: CID;
};

export type EntryLeaf = {
    type: LeafKind.Entry;
    link: CID;
    creator: CID;
};

export type IdentityLeaf = {
    type: LeafKind.Identity;
    link: CID;
};

export type SortedEntryLeaf = {
    type: LeafKind.SortedEntry;
    link: CID;
    sort: number[];
    key: string;
    creator: CID;
};

export type Leaf = EmptyLeaf | HashLeaf | PollardLeaf | EntryLeaf | IdentityLeaf | SortedEntryLeaf;
