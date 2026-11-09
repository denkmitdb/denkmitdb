import { CID } from "multiformats/cid";
import { Optional } from "utility-types";
import { Leaf, POLLARD_VERSION } from "../protocol/tree.js";
import type { Pollard } from "./pollard.js";

export type PollardLocation = {
    layerIndex: number;
    position: number;
};


export type PollardType = {
    readonly version: typeof POLLARD_VERSION;
    readonly order: number;
    readonly maxLength: number;
    readonly length: number;
    readonly layers: Leaf[][];
    readonly cid: CID;
};

export type PollardInput = Optional<Omit<PollardType, "version" | "maxLength">, "cid">;

export type PollardNode = PollardLocation & {
    pollard?: Pollard;
};

export type PollardOptions = {
    cid?: CID;
    noUpdate?: boolean;
    hashFunc?: (data: Uint8Array) => Promise<Uint8Array>;
};

