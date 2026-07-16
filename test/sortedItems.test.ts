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
        await store.set(100, "k1", cid, creator);

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

    it("iteratorFrom starts at the given sort field", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "a", await cidOf("a"), creator);
        await store.set(200, "b", await cidOf("b"), creator);
        await store.set(300, "c", await cidOf("c"), creator);

        const keys: string[] = [];
        for await (const item of store.iteratorFrom(200)) keys.push(item.key);
        expect(keys).toEqual(["b", "c"]);
    });

    it("getByKey reflects the latest set() for a key", async () => {
        // Note: this covers key lookup only. The superseded physical record is
        // NOT removed from the sorted index — that defect is pinned separately
        // below (KNOWN_ISSUES.md #2 part 2).
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("old"), creator);
        await store.set(200, "k", await cidOf("new"), creator);

        const item = await store.getByKey("k");
        expect(item?.sortField).toBe(200);
        expect(item?.cid.equals(await cidOf("new"))).toBe(true);
    });

    // KNOWN_ISSUES.md #2 (part 2): superseding a key leaves the previous timestamp entry
    // orphaned in the sorted map, so size and the Merkle tree still include the stale record.
    it.fails("superseded records should not remain in the sorted index (known bug)", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("old"), creator);
        await store.set(200, "k", await cidOf("new"), creator);
        expect(store.size).toBe(1);
    });

    // KNOWN_ISSUES.md #2 (part 1): `set` overwrites the key map unconditionally, so whichever
    // record is merged *last* wins, not the one with the newest timestamp. Last-write-wins by
    // timestamp is the documented conflict-resolution model.
    it.fails("an older record must not overwrite a newer one for the same key (known bug)", async () => {
        const store = new SortedItemsStore();
        const newerCreator = await cidOf("newer-creator");
        await store.set(200, "k", await cidOf("new"), newerCreator);
        await store.set(100, "k", await cidOf("old"), creator); // e.g. merged later from a peer

        // The full record must survive — timestamp, CID, and creator — so a
        // partial fix that repairs only the sort field cannot satisfy this pin.
        const item = await store.getByKey("k");
        expect(item?.sortField).toBe(200);
        expect(item?.cid.equals(await cidOf("new"))).toBe(true);
        expect(item?.creator.equals(newerCreator)).toBe(true);
    });

    // KNOWN_ISSUES.md #3: the sorted index is keyed by millisecond timestamp alone, so two
    // different keys written in the same millisecond collide and one record is lost.
    it.fails("two keys with the same sort field must both survive (known bug)", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k1", await cidOf("v1"), creator);
        await store.set(100, "k2", await cidOf("v2"), creator);

        const keys: string[] = [];
        for await (const item of store.iterator()) keys.push(item.key);
        expect(keys.sort()).toEqual(["k1", "k2"]);
    });

    it("clear empties the store", async () => {
        const store = new SortedItemsStore();
        await store.set(100, "k", await cidOf("v"), creator);
        await store.clear();
        expect(store.size).toBe(0);
        expect(await store.getByKey("k")).toBeUndefined();
    });
});
