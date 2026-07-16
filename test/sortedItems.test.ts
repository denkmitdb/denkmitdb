import * as codec from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { describe, expect, it } from "vitest";
import { SortedItemsStore } from "../src/functions";

async function cidOf(value: unknown): Promise<CID> {
    const bytes = codec.encode(value);
    return CID.createV1(codec.code, await sha256.digest(bytes));
}

const creator = await cidOf("creator");

describe("SortedItemsStore", () => {
    it("stores and retrieves items by key", async () => {
        const store = new SortedItemsStore();
        const cid = await cidOf("v1");
        expect(await store.set(100, "k1", cid, creator)).toEqual({ applied: true });

        const item = await store.getByKey("k1");
        expect(item).toBeDefined();
        expect(item?.sortField).toBe(100);
        expect(item?.cid.equals(cid)).toBe(true);
        expect(store.size).toBe(1);
    });

    it("iterates in sort-field order regardless of insertion order", async () => {
        const store = new SortedItemsStore();
        await store.set(300, "c", await cidOf("c"), creator);
        await store.set(100, "a", await cidOf("a"), creator);
        await store.set(200, "b", await cidOf("b"), creator);

        const keys: string[] = [];
        for await (const item of store.iterator()) keys.push(item.key);
        expect(keys).toEqual(["a", "b", "c"]);
    });

    it("iteratorFromIndex starts at the given position", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "a", await cidOf("a"), creator);
        await store.set(200, "b", await cidOf("b"), creator);
        await store.set(300, "c", await cidOf("c"), creator);

        const keys: string[] = [];
        for await (const item of store.iteratorFromIndex(1)) keys.push(item.key);
        expect(keys).toEqual(["b", "c"]);
    });

    it("getByKey reflects the winning set() for a key", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("old"), creator);
        await store.set(200, "k", await cidOf("new"), creator);

        const item = await store.getByKey("k");
        expect(item?.sortField).toBe(200);
        expect(item?.cid.equals(await cidOf("new"))).toBe(true);
    });

    // KNOWN_ISSUES.md #2 part 2 — superseding a key removes the previous record,
    // so exactly one live record per key remains in the ordered index.
    it("removes superseded records from the sorted index", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("old"), creator);
        const result = await store.set(200, "k", await cidOf("new"), creator);
        expect(result).toEqual({ applied: true, previousTimestamp: 100 });
        expect(store.size).toBe(1);
    });

    // KNOWN_ISSUES.md #2 part 1 — last-write-wins by composite key: an older record
    // merged later must not overwrite the newer one, and its full record survives.
    it("keeps the newer record when an older one is set for the same key", async () => {
        const store = new SortedItemsStore();
        const newerCreator = await cidOf("newer-creator");
        expect(await store.set(200, "k", await cidOf("new"), newerCreator)).toEqual({ applied: true });
        expect(await store.set(100, "k", await cidOf("old"), creator)).toEqual({ applied: false });

        const item = await store.getByKey("k");
        expect(item?.sortField).toBe(200);
        expect(item?.cid.equals(await cidOf("new"))).toBe(true);
        expect(item?.creator.equals(newerCreator)).toBe(true);
        expect(store.size).toBe(1);
    });

    // KNOWN_ISSUES.md #3 — the composite key (timestamp, entry CID) keeps two keys
    // written in the same millisecond distinct; neither is lost.
    it("keeps two keys with the same timestamp via the CID tie-break", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k1", await cidOf("v1"), creator);
        await store.set(100, "k2", await cidOf("v2"), creator);
        expect(store.size).toBe(2);

        const keys: string[] = [];
        for await (const item of store.iterator()) keys.push(item.key);
        expect(keys.slice().sort()).toEqual(["k1", "k2"]);
    });

    it("clear empties the store", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("v"), creator);
        await store.clear();
        expect(store.size).toBe(0);
        expect(await store.getByKey("k")).toBeUndefined();
    });
});
