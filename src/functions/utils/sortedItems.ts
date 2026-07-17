import { OrderedMap } from "js-sdsl";
import { CID } from "multiformats/cid";
import { SetResult, SortedItemsStoreInterface, SortedItemType } from "../../types/index.js";

/**
 * The canonical order over entries (specs/ordering.md): timestamp first, entry
 * CID bytes as the deterministic tie-break. Because entry CIDs are collision-
 * resistant content hashes, this is a total order — no two distinct entries
 * share a key, so same-millisecond writes no longer collide (KNOWN_ISSUES.md #3).
 */
type CompositeKey = { readonly timestamp: number; readonly cid: Uint8Array };

type Record = { cid: CID; key: string; creator: CID; deleted?: boolean };

function compareBytes(a: Uint8Array, b: Uint8Array): number {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

function compareKeys(a: CompositeKey, b: CompositeKey): number {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return compareBytes(a.cid, b.cid);
}

export class SortedItemsStore implements SortedItemsStoreInterface {
    private sortedMap: OrderedMap<CompositeKey, Record>;
    private keyMap: Map<string, { timestamp: number; cid: CID; creator: CID; deleted?: boolean }>;

    constructor() {
        this.sortedMap = new OrderedMap<CompositeKey, Record>([], compareKeys, true);
        this.keyMap = new Map();
    }

    /**
     * Inserts a record for `key`, resolving conflicts by last-write-wins on the
     * composite key (KNOWN_ISSUES.md #2). The winner is the record with the
     * greatest `(timestamp, cid)`.
     *
     * @returns `applied` — whether this record is now the live record for `key`.
     *   When it wins over a previous record, `previousTimestamp` carries that
     *   record's timestamp so callers can rebuild the tree from the earlier of
     *   the two positions.
     */
    async set(sortField: number, key: string, cid: CID, creator: CID, deleted?: boolean): Promise<SetResult> {
        const incoming: CompositeKey = { timestamp: sortField, cid: cid.bytes };
        const existing = this.keyMap.get(key);

        if (existing) {
            const current: CompositeKey = { timestamp: existing.timestamp, cid: existing.cid.bytes };
            // Incoming loses to (or duplicates) the record already held for the key.
            if (compareKeys(incoming, current) <= 0) return { applied: false };
            // Incoming wins: drop the superseded record from the ordered index so
            // exactly one live record per key remains (KNOWN_ISSUES.md #2 part 2).
            this.sortedMap.eraseElementByKey(current);
            this.keyMap.set(key, { timestamp: sortField, cid, creator, ...(deleted ? { deleted } : {}) });
            this.sortedMap.setElement(incoming, { cid, key, creator, ...(deleted ? { deleted } : {}) });
            return { applied: true, previousTimestamp: existing.timestamp };
        }

        this.keyMap.set(key, { timestamp: sortField, cid, creator, ...(deleted ? { deleted } : {}) });
        this.sortedMap.setElement(incoming, { cid, key, creator, ...(deleted ? { deleted } : {}) });
        return { applied: true };
    }

    async getByKey(key: string): Promise<SortedItemType | undefined> {
        const res = this.keyMap.get(key);
        if (!res) return undefined;
        const composite: CompositeKey = { timestamp: res.timestamp, cid: res.cid.bytes };
        const it = this.sortedMap.find(composite);
        return { cid: res.cid, key, creator: res.creator, sortField: res.timestamp, index: it.index, ...(res.deleted ? { deleted: true } : {}) };
    }

    async *iterator(): AsyncGenerator<SortedItemType> {
        let index = 0;
        for (const [composite, entry] of this.sortedMap) {
            yield { ...entry, sortField: composite.timestamp, index };
            index++;
        }
    }

    /**
     * The index of the first record whose composite key is at or after
     * `sortField` (interpreted as a timestamp lower bound). Used to locate where a
     * tree rebuild must start. Returns `size` when nothing is at or after it.
     */
    async find(sortField: number): Promise<SortedItemType> {
        const lower: CompositeKey = { timestamp: sortField, cid: new Uint8Array(0) };
        const it = this.sortedMap.lowerBound(lower);
        if (it.equals(this.sortedMap.end())) {
            return {
                cid: undefined as unknown as CID,
                key: "",
                creator: undefined as unknown as CID,
                sortField,
                index: this.sortedMap.size(),
            };
        }
        return { ...it.pointer[1], sortField: it.pointer[0].timestamp, index: it.index };
    }

    async getByIndex(index: number): Promise<SortedItemType> {
        const [composite, entry] = this.sortedMap.getElementByPos(index);
        return { ...entry, sortField: composite.timestamp, index };
    }

    /** Iterates records in composite-key order starting at position `startIndex`. */
    async *iteratorFromIndex(startIndex: number): AsyncGenerator<SortedItemType> {
        const size = this.sortedMap.size();
        for (let index = startIndex; index < size; index++) {
            const [composite, entry] = this.sortedMap.getElementByPos(index);
            yield { ...entry, sortField: composite.timestamp, index };
        }
    }

    get size(): number {
        return this.sortedMap.size();
    }

    async clear(): Promise<void> {
        this.sortedMap.clear();
        this.keyMap.clear();
    }
}
