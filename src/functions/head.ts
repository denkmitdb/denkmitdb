import { CID } from "multiformats/cid";
import { HEAD_VERSION, HeadData, HeadInterface, HeadType, HeadVersionType, HeliaControllerInterface } from "src/types";

export class Head implements HeadInterface {
    readonly version: HeadVersionType;
    readonly manifest: CID;
    readonly root: CID;
    readonly timestamp: number;
    readonly layers: number;
    readonly size: number;
    readonly creator: CID;
    readonly cid: CID;
    readonly link: CID;

    constructor(head: HeadType) {
        this.version = head.version || HEAD_VERSION;
        this.manifest = head.manifest;
        this.root = head.root;
        this.timestamp = head.timestamp;
        this.layers = head.layers;
        this.size = head.size;
        this.creator = head.creator;
        this.cid = head.cid;
        this.link = head.link;
    }
}

export async function createHead(head: HeadData, heliaController: HeliaControllerInterface): Promise<HeadInterface> {
    const result = await heliaController.addSignedV2(head);

    return new Head({ ...result.data, ...result });
}

export async function fetchHead(cid: CID, heliaController: HeliaControllerInterface): Promise<HeadInterface> {
    const result = await heliaController.getSignedV2<HeadData>(cid);
    if (!result || !result.data) throw new Error("Head not found");
    return new Head({ ...result.data, ...result });
}