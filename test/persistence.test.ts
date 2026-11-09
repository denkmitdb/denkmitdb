import Keyv from "keyv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, headStoreKey, openDatabase } from "../src/internal";
import { createTestNode, TestNode } from "./helpers";

type Value = { value: string };

/**
 * KNOWN_ISSUES.md D4 (minimal slice): the last locally built head CID is persisted
 * in the Helia datastore under a manifest-namespaced key, and open restores from it
 * through the same authenticated path as a remote announcement — so a database
 * reopens its own state with no live peer. Durability across process restarts
 * follows the stores the caller gives Helia (persistent datastore/blockstore).
 */
describe("Local head persistence (D4)", () => {
    let node: TestNode;

    beforeAll(async () => {
        node = await createTestNode("persist-owner");
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("persists the head pointer under the manifest-namespaced key", async () => {
        const db = await createDatabase<Value>("persist-key", {
            helia: node.helia,
            identity: node.identity,
        });
        await db.set("k", { value: "v" });
        await db.waitUntilIdle();
        const head = await db.createHead();

        const stored = await node.helia.datastore.get(headStoreKey(db.address));
        expect(Buffer.from(stored).equals(Buffer.from(head.cid.bytes))).toBe(true);
        await db.close();
    });

    it("reopens its own state with no live peer", async () => {
        const db = await createDatabase<Value>("persist-reopen", {
            helia: node.helia,
            identity: node.identity,
        });
        const address = db.address;
        await db.set("a", { value: "1" });
        await db.set("b", { value: "2" });
        await db.waitUntilIdle();
        const headBefore = await db.createHead(); // builds + persists the pointer
        await db.close();

        // Reopen by address only — no peer announces anything. Restore goes through
        // syncNewHead, so the head is re-validated like a remote announcement.
        const reopened = await openDatabase<Value>(address, {
            helia: node.helia,
            identity: node.identity,
        });
        await reopened.waitUntilIdle();

        expect(reopened.recordCount).toBe(2);
        expect(await reopened.get("a")).toEqual({ value: "1" });
        expect(await reopened.get("b")).toEqual({ value: "2" });
        const headAfter = await reopened.createHead();
        expect(headAfter.root.equals(headBefore.root)).toBe(true);
        await reopened.close();
    });

    it("does not clear a caller-supplied Keyv on close", async () => {
        const myStore = new Keyv<Value>();
        const db = await createDatabase<Value>("persist-keyv", {
            helia: node.helia,
            identity: node.identity,
            valueCache: myStore,
        });
        await db.set("mine", { value: "kept" });
        await db.waitUntilIdle();
        const cacheKey = (await db.provenance("mine"))!.entryCid.toString(); // keyed by entry CID (#30)
        await db.close();

        // The caller's store survives close(); only internally owned caches are cleared.
        expect(await myStore.get(cacheKey)).toEqual({ value: "kept" });
    });
});
