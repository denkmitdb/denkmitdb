import { OrderedMap } from "js-sdsl";
import { CID } from "multiformats/cid";

/** One record in the sorted index. */
export type SortedItem = {
    readonly timestamp: number;
    readonly cid: CID;
    readonly key: string;
    readonly creator: CID;
    readonly index: number;
    /** True when the record is a tombstone (the key is deleted). */
    readonly deleted?: boolean;
};

/**
 * Outcome of {@link SortedItemsStore.set}. `applied` is true when the record
 * became the live record for its key (last-write-wins). When it displaced an
 * earlier record, `previousTimestamp` is that record's timestamp, so the tree can
 * be rebuilt from the earlier of the two positions.
 */
export type SetResult = {
    readonly applied: boolean;
    readonly previousTimestamp?: number;
    /** CID of the record this one superseded, when it won over a previous record. */
    readonly previousCid?: CID;
};

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

export class SortedItemsStore {
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
    async set(timestamp: number, key: string, cid: CID, creator: CID, deleted?: boolean): Promise<SetResult> {
        const incoming: CompositeKey = { timestamp, cid: cid.bytes };
        const existing = this.keyMap.get(key);

        if (existing) {
            const current: CompositeKey = { timestamp: existing.timestamp, cid: existing.cid.bytes };
            // Incoming loses to (or duplicates) the record already held for the key.
            if (compareKeys(incoming, current) <= 0) return { applied: false };
            // Incoming wins: drop the superseded record from the ordered index so
            // exactly one live record per key remains (KNOWN_ISSUES.md #2 part 2).
            this.sortedMap.eraseElementByKey(current);
            this.keyMap.set(key, { timestamp, cid, creator, ...(deleted ? { deleted } : {}) });
            this.sortedMap.setElement(incoming, { cid, key, creator, ...(deleted ? { deleted } : {}) });
            return { applied: true, previousTimestamp: existing.timestamp, previousCid: existing.cid };
        }

        this.keyMap.set(key, { timestamp, cid, creator, ...(deleted ? { deleted } : {}) });
        this.sortedMap.setElement(incoming, { cid, key, creator, ...(deleted ? { deleted } : {}) });
        return { applied: true };
    }

    /**
     * Whether `set(timestamp, key, cid, …)` would make this record the live record
     * for `key` — the same last-write-wins comparison, without mutating anything.
     * Lets ingestion do fallible work (pinning) before it touches the index
     * (KNOWN_ISSUES.md #31).
     */
    wouldApply(timestamp: number, key: string, cid: CID): boolean {
        const existing = this.keyMap.get(key);
        if (!existing) return true;
        return (
            compareKeys(
                { timestamp, cid: cid.bytes },
                { timestamp: existing.timestamp, cid: existing.cid.bytes },
            ) > 0
        );
    }

    /**
     * The live record for `key` straight from the key map — no positional index
     * computed, so it is cheap enough for every `get()`.
     */
    getRecord(key: string): { cid: CID; creator: CID; timestamp: number; deleted?: boolean } | undefined {
        return this.keyMap.get(key);
    }

    async getByKey(key: string): Promise<SortedItem | undefined> {
        const res = this.keyMap.get(key);
        if (!res) return undefined;
        const composite: CompositeKey = { timestamp: res.timestamp, cid: res.cid.bytes };
        const it = this.sortedMap.find(composite);
        return { cid: res.cid, key, creator: res.creator, timestamp: res.timestamp, index: it.index, ...(res.deleted ? { deleted: true } : {}) };
    }

    async *iterator(): AsyncGenerator<SortedItem> {
        let index = 0;
        for (const [composite, entry] of this.sortedMap) {
            yield { ...entry, timestamp: composite.timestamp, index };
            index++;
        }
    }

    /**
     * The index of the first record whose composite key is at or after
     * `timestamp` (interpreted as a timestamp lower bound). Used to locate where a
     * tree rebuild must start. Returns `size` when nothing is at or after it.
     */
    async find(timestamp: number): Promise<SortedItem> {
        const lower: CompositeKey = { timestamp, cid: new Uint8Array(0) };
        const it = this.sortedMap.lowerBound(lower);
        if (it.equals(this.sortedMap.end())) {
            return {
                cid: undefined as unknown as CID,
                key: "",
                creator: undefined as unknown as CID,
                timestamp,
                index: this.sortedMap.size(),
            };
        }
        return { ...it.pointer[1], timestamp: it.pointer[0].timestamp, index: it.index };
    }

    async getByIndex(index: number): Promise<SortedItem> {
        const [composite, entry] = this.sortedMap.getElementByPos(index);
        return { ...entry, timestamp: composite.timestamp, index };
    }

    /**
     * Iterates records in composite-key order starting at position `startIndex`.
     *
     * js-sdsl's `getElementByPos` is an O(pos) in-order walk, so calling it per
     * record made every tree rebuild O(n²) (KNOWN_ISSUES.md #27). This takes one
     * positional lookup, then walks forward with a tree iterator. The range is
     * snapshotted synchronously before the first yield: callers await between
     * records, and a concurrent `set()` that supersedes a record erases its tree
     * node, which would invalidate a live iterator.
     */
    async *iteratorFromIndex(startIndex: number): AsyncGenerator<SortedItem> {
        if (startIndex >= this.sortedMap.size()) return;
        const [first] = this.sortedMap.getElementByPos(Math.max(0, startIndex));
        const snapshot: SortedItem[] = [];
        const end = this.sortedMap.end();
        let index = Math.max(0, startIndex);
        for (let it = this.sortedMap.find(first); !it.equals(end); it = it.next()) {
            const [composite, entry] = it.pointer;
            snapshot.push({ ...entry, timestamp: composite.timestamp, index });
            index++;
        }
        yield* snapshot;
    }

    get size(): number {
        return this.sortedMap.size();
    }

    async clear(): Promise<void> {
        this.sortedMap.clear();
        this.keyMap.clear();
    }
}
