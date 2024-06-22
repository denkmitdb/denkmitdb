import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "src/types";
import { MANIFEST_VERSION, ManifestData, ManifestInterface, ManifestVersionType } from "../types/manifest";

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
    const result = await heliaController.addSignedV2<ManifestData>(manifest);
    return new Manifest(result);
}

export async function fetchManifest(cid: CID, heliaController: HeliaControllerInterface): Promise<ManifestInterface> {
    const result = await heliaController.getSignedV2<ManifestData>(cid);
    if (!result || !result.data) throw new Error(`Manifest not found.`);
    return new Manifest(result);
}
