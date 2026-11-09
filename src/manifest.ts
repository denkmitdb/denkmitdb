import { CID } from "multiformats/cid";
import { assertManifestPayload, ManifestPayload } from "./protocol/manifest.js";
import type { Signed } from "./protocol/signed.js";
import type { HeliaController } from "./storage/helia.js";
import type { Manifest } from "./types.js";

function toManifest(signed: Signed<ManifestPayload>): Manifest {
    const { version, timestamp, name, type, order, consensus, access, meta } = signed.data;
    return {
        version,
        timestamp,
        name,
        type,
        order,
        access,
        validation: consensus,
        ...(meta !== undefined ? { meta } : {}),
        cid: signed.cid,
        creator: signed.creator,
    };
}

/** Signs and stores a manifest payload; the returned manifest's CID is the database address. */
export async function createManifest(payload: ManifestPayload, controller: HeliaController): Promise<Manifest> {
    return toManifest(await controller.addSigned(payload));
}

/**
 * Fetches, verifies and shape-checks a manifest.
 * @throws Error - If the manifest is missing or fails to verify.
 * @throws TypeError - If it is not a well-formed manifest.
 */
export async function fetchManifest(cid: CID, controller: HeliaController): Promise<Manifest> {
    const result = await controller.getSigned<ManifestPayload>(cid);
    if (!result) throw new Error("Manifest not found");
    assertManifestPayload(result.data);
    return toManifest(result);
}
