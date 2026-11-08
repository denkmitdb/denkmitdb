import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "../types/index.js";
import {
    LEGACY_MANIFEST_VERSION,
    MANIFEST_VERSION,
    ManifestData,
    ManifestInterface,
    ManifestVersionType,
} from "../types/manifest.js";

export class Manifest implements ManifestInterface {
    readonly version: ManifestVersionType;
    readonly timestamp: number;
    readonly name: string;
    readonly type: string;
    readonly order: number;
    readonly consensus: CID;
    readonly access: CID;
    readonly meta?: Record<string, unknown>;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    constructor(manifest: DenkmitData<ManifestData>) {
        this.version = manifest.data.version ?? MANIFEST_VERSION;
        this.timestamp = manifest.data.timestamp;
        this.name = manifest.data.name;
        this.type = manifest.data.type;
        this.order = manifest.data.order;
        this.consensus = manifest.data.consensus;
        this.access = manifest.data.access;
        this.meta = manifest.data.meta;
        this.cid = manifest.cid;
        this.creator = manifest.creator;
        this.link = manifest.link;
    }

    async verify(): Promise<boolean> {
        return true;
    }

    toJSON(): ManifestData {
        return {
            version: this.version,
            timestamp: this.timestamp,
            name: this.name,
            type: this.type,
            order: this.order,
            consensus: this.consensus,
            access: this.access,
            meta: this.meta,
        };
    }
}

export async function createManifest(
    manifest: ManifestData,
    heliaController: HeliaControllerInterface,
): Promise<ManifestInterface> {
    const result = await heliaController.addSigned<ManifestData>(manifest);
    return new Manifest(result);
}

export async function fetchManifest(cid: CID, heliaController: HeliaControllerInterface): Promise<ManifestInterface> {
    const result = await heliaController.getSigned<ManifestData>(cid);
    if (!result || !result.data) throw new Error(`Manifest not found.`);
    assertManifestShape(result.data);
    return new Manifest(result);
}

/**
 * Checks a fetched manifest the way `createDenkmitDatabase` checks its inputs: a
 * signature proves who wrote a manifest, not that it is usable (KNOWN_ISSUES.md #24).
 *
 * @param data - The decoded, signature-verified manifest payload.
 * @throws TypeError - If the manifest is not a well-formed v1 or v2 manifest.
 */
export function assertManifestShape(data: unknown): asserts data is ManifestData {
    if (typeof data !== "object" || data === null) throw new TypeError("Manifest is not an object");
    const manifest = data as Record<string, unknown>;
    if (manifest.version !== MANIFEST_VERSION && manifest.version !== LEGACY_MANIFEST_VERSION) {
        throw new TypeError(`Unsupported manifest version ${String(manifest.version)}`);
    }
    const order = manifest.order;
    if (typeof order !== "number" || !Number.isInteger(order) || order < 1 || order > 8) {
        throw new TypeError("Manifest order must be an integer in [1, 8]");
    }
    if (CID.asCID(manifest.consensus) === null || CID.asCID(manifest.access) === null) {
        throw new TypeError("Manifest policies must be CIDs");
    }
    if (typeof manifest.name !== "string" || typeof manifest.type !== "string") {
        throw new TypeError("Manifest name and type must be strings");
    }
}
