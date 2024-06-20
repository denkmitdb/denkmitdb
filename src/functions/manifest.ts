import { CID } from "multiformats/cid";
import { HeliaControllerInterface } from "src/types";
import { MANIFEST_VERSION, ManifestData, ManifestInterface, ManifestType } from "../types/manifest";

export class Manifest implements ManifestInterface {
    readonly version = MANIFEST_VERSION;
    readonly timestamp: number;
    readonly name: string;
    readonly type: string;
    readonly order: number;
    readonly consensus: CID;
    readonly access: CID;
    readonly meta?: Record<string, unknown>;
    readonly cid: CID;
    readonly link: CID;
    readonly creator: CID

    constructor(manifest: ManifestType) {
        this.version = manifest.version;
        this.timestamp = manifest.timestamp;
        this.name = manifest.name;
        this.type = manifest.type;
        this.order = manifest.order;
        this.consensus = manifest.consensus;
        this.access = manifest.access;
        this.creator = manifest.creator;
        this.meta = manifest.meta;
        this.cid = manifest.cid;
        this.link = manifest.link;
        this.creator = manifest.creator;
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

export async function createManifest(manifest: ManifestData, heliaController: HeliaControllerInterface): Promise<ManifestInterface> {
    const result = await heliaController.addSignedV2<ManifestData>(manifest);

    return new Manifest({ ...manifest, ...result });
}

export async function fetchManifest(cid: CID, heliaController: HeliaControllerInterface): Promise<ManifestInterface> {
    const result = await heliaController.getSignedV2<ManifestData>(cid);
    if (!result || !result.data) throw new Error(`Manifest not found.`);

    return new Manifest({ ...result.data, ...result });
}
