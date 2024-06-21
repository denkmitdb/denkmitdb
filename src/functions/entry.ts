import { ENTRY_VERSION, EntryInterface, EntryData, HeliaControllerInterface, DenkmitData } from "../types";
import { CID } from "multiformats/cid";

export class Entry<T> implements EntryInterface<T> {
    readonly version = ENTRY_VERSION;
    readonly timestamp: number;
    readonly key: string;
    readonly value: T;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    constructor(entry: DenkmitData<EntryData<T>>) {
        this.timestamp = entry.data.timestamp;
        this.key = entry.data.key;
        this.value = entry.data.value;

        this.cid = entry.cid;
        this.creator = entry.creator;
        this.link = entry.link;
    }

    toJSON(): EntryData<T> {
        return {
            version: this.version,
            timestamp: this.timestamp,
            key: this.key,
            value: this.value,
        };
    }
}

export async function createEntry<T>(key: string, value: T, heliaController: HeliaControllerInterface): Promise<EntryInterface<T>> {
    const data: EntryData<T> = {
        version: ENTRY_VERSION,
        timestamp: Date.now(),
        key,
        value
    };

    const result = await heliaController.addSignedV2(data);
    return new Entry(result);
}

export async function fetchEntry<T>(cid: CID, heliaController: HeliaControllerInterface): Promise<EntryInterface<T>> {
    const result = await heliaController.getSignedV2<EntryData<T>>(cid);
    if (!result) throw new Error("Entry not found");
    if (!result.data) throw new Error("Entry data not found");

    return new Entry(result);
}
