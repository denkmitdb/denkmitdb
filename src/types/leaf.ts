import { CID } from "multiformats/cid";

export enum LeafTypes {
    Empty = 0,
    Hash = 1,
    Pollard = 2,
    Entry = 3,
    Identity = 4,
    SortedEntry = 5,
}

export type EmptyLeaf = {
    type: LeafTypes.Empty;
};

export type HashLeaf = {
    type: LeafTypes.Hash;
    hash: Uint8Array;
};

export type PollardLeaf = {
    type: LeafTypes.Pollard;
    link: CID;
};

export type EntryLeaf = {
    type: LeafTypes.Entry;
    link: CID;
    creator: CID;
};

export type IdentityLeaf = {
    type: LeafTypes.Identity;
    link: CID;
};

export type SortedEntryLeaf = {
    type: LeafTypes.SortedEntry;
    link: CID;
    sort: number[];
    key: string;
    creator: CID;
};

export type LeafType = EmptyLeaf | HashLeaf | PollardLeaf | EntryLeaf | IdentityLeaf | SortedEntryLeaf;
