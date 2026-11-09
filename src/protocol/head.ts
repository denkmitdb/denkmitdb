import type { CID } from "multiformats/cid";

export const HEAD_VERSION = 2;

/** The signed head payload: a snapshot of a database's Merkle tree. */
export type HeadPayload = {
    readonly version: typeof HEAD_VERSION;
    /** Address of the database the head belongs to. */
    readonly manifest: CID;
    /** Root of the top tree layer. */
    readonly root: CID;
    readonly timestamp: number;
    readonly layers: number;
    /** Number of records (tombstones included). */
    readonly size: number;
};
