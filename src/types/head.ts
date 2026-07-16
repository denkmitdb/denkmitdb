import { CID } from "multiformats/cid";
import { DenkmitMetadata } from "./utils.js";

export const HEAD_VERSION = 2;
export type HeadVersionType = typeof HEAD_VERSION;

export type HeadData = {
    readonly version: HeadVersionType;
    readonly manifest: CID;
    readonly root: CID;
    readonly timestamp: number;
    readonly layers: number;
    readonly size: number;
};

export type HeadType = HeadData & DenkmitMetadata;

export type HeadInterface = HeadType;

