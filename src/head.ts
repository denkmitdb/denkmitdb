import { CID } from "multiformats/cid";
import type { HeadPayload } from "./protocol/head.js";
import type { Signed, SignedMeta } from "./protocol/signed.js";
import type { HeliaController } from "./storage/helia.js";

/** A verified signed head. */
export type Head = HeadPayload & SignedMeta;

function toHead(signed: Signed<HeadPayload>): Head {
    return { ...signed.data, cid: signed.cid, creator: signed.creator };
}

/** Signs and stores a head. */
export async function createHead(payload: HeadPayload, controller: HeliaController): Promise<Head> {
    return toHead(await controller.addSigned(payload));
}

/** Fetches and verifies a head. */
export async function fetchHead(cid: CID, controller: HeliaController): Promise<Head> {
    const result = await controller.getSigned<HeadPayload>(cid);
    if (!result) throw new Error("Head not found");
    return toHead(result);
}
