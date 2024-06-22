import { CID } from "multiformats/cid";
import {
    DenkmitData,
    HEAD_VERSION,
    HeadData,
    HeadInterface,
    HeadVersionType,
    HeliaControllerInterface,
} from "../types";

export class Head implements HeadInterface {
    readonly version: HeadVersionType;
    readonly manifest: CID;
    readonly root: CID;
    readonly timestamp: number;
    readonly layers: number;
    readonly size: number;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    constructor(head: DenkmitData<HeadData>) {
        this.version = head.data.version || HEAD_VERSION;
        this.manifest = head.data.manifest;
        this.root = head.data.root;
        this.timestamp = head.data.timestamp;
        this.layers = head.data.layers;
        this.size = head.data.size;

        this.cid = head.cid;
        this.creator = head.creator;
        this.link = head.link;
    }
}

export async function createHead(head: HeadData, heliaController: HeliaControllerInterface): Promise<HeadInterface> {
    const result = await heliaController.addSignedV2(head);
    return new Head(result);
}

export async function fetchHead(cid: CID, heliaController: HeliaControllerInterface): Promise<HeadInterface> {
    const result = await heliaController.getSignedV2<HeadData>(cid);
    if (!result || !result.data) throw new Error("Head not found");
    return new Head(result);
}
