import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createSyncController,
    HeliaController,
    SyncController,
} from "../src/functions";
import { createTestNode, TestNode } from "./helpers";

type Value = { value: string };

describe("DenkmitDatabase (single node)", () => {
    let node: TestNode;
    let syncController: SyncController;
    let db: Awaited<ReturnType<typeof createDenkmitDatabase<Value>>>;

    beforeAll(async () => {
        node = await createTestNode("db-tests");
        const heliaController = new HeliaController(node.helia, node.identity);
        // Passing our own sync controller lets tests await the internal task queue.
        syncController = (await createSyncController("db-test", heliaController)) as SyncController;
        db = await createDenkmitDatabase<Value>("db-test", {
            helia: node.helia,
            identity: node.identity,
            syncController,
        });
    });

    afterAll(async () => {
        await db.close();
        await node.stop();
    });

    it("exposes its manifest CID as the database address", async () => {
        expect(db.address).toBeDefined();
        const manifest = await db.getManifest();
        expect(manifest.name).toBe("db-test");
        expect(manifest.type).toBe("denkmit-database-key-value");
        expect(db.address.equals(manifest.cid)).toBe(true);
    });

    it("sets and gets values", async () => {
        await db.set("key1", { value: "value1" });
        await db.set("key2", { value: "value2" });
        await syncController.queue.onIdle();

        expect(await db.get("key1")).toEqual({ value: "value1" });
        expect(await db.get("key2")).toEqual({ value: "value2" });
        expect(db.size).toBe(2);
    });

    it("returns undefined for a missing key", async () => {
        expect(await db.get("no-such-key")).toBeUndefined();
    });

    it("iterates over all entries in write order", async () => {
        const seen: Record<string, Value> = {};
        for await (const [key, value] of db.iterator()) {
            seen[key] = value;
        }
        expect(seen).toEqual({ key1: { value: "value1" }, key2: { value: "value2" } });
    });

    it("builds Merkle layers and derives a head from them", async () => {
        await syncController.queue.onIdle();
        expect(db.layers.length).toBeGreaterThan(0);

        const head = await db.createHead();
        expect(head.manifest.equals(db.address)).toBe(true);
        expect(head.size).toBe(db.size);
        expect(head.root).toBeDefined();
    });

    it("does not mint a new head when nothing changed", async () => {
        const first = await db.createHead();
        const again = await db.createHead();
        expect(again.cid.equals(first.cid)).toBe(true);
    });

    it("changes the head root when data changes", async () => {
        const before = await db.createHead();
        await db.set("key3", { value: "value3" });
        await syncController.queue.onIdle();
        const after = await db.createHead();
        expect(after.root.equals(before.root)).toBe(false);
        expect(after.size).toBe(3);
    });
});
