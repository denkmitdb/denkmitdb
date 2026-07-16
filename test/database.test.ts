import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createSyncController,
    fetchConsensus,
    HeliaController,
    SyncController,
} from "../src/functions";
import { createTestNode, TestNode } from "./helpers";

type Value = { value: string };

describe("DenkmitDatabase (single node)", () => {
    let node: TestNode;
    let heliaController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("db-tests");
        heliaController = new HeliaController(node.helia, node.identity);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    /** Each test gets its own database so no test depends on another's writes. */
    async function createDb(name: string) {
        // Passing our own sync controller lets tests await the internal task queue.
        const syncController = (await createSyncController(name, heliaController)) as SyncController;
        const db = await createDenkmitDatabase<Value>(name, {
            helia: node.helia,
            identity: node.identity,
            syncController,
        });
        return { db, drain: () => syncController.queue.onIdle() };
    }

    it("exposes its manifest CID as the database address", async () => {
        const { db } = await createDb("db-address");
        const manifest = await db.getManifest();
        expect(manifest.name).toBe("db-address");
        expect(manifest.type).toBe("denkmit-database-key-value");
        expect(db.address.equals(manifest.cid)).toBe(true);
        await db.close();
    });

    it("installs the default constant-true consensus rule in the manifest", async () => {
        // Documents the current world-writable default (KNOWN_ISSUES.md D1) by
        // checking what the factory actually wired, not a hand-built controller.
        const { db } = await createDb("db-consensus-wiring");
        const manifest = await db.getManifest();
        const installed = await fetchConsensus(manifest.consensus, heliaController);
        expect(installed.name).toBe("denkmit-timestamp");
        expect(installed.logic).toBe(true);
        expect(await installed.execute({ anything: "goes" })).toBe(true);
        await db.close();
    });

    it("returns undefined for a missing key", async () => {
        const { db } = await createDb("db-missing-key");
        expect(await db.get("no-such-key")).toBeUndefined();
        await db.close();
    });

    it("runs the full write → read → tree → head lifecycle", async () => {
        const { db, drain } = await createDb("db-lifecycle");

        // Write and read back.
        await db.set("key1", { value: "value1" });
        await db.set("key2", { value: "value2" });
        await drain();
        expect(await db.get("key1")).toEqual({ value: "value1" });
        expect(await db.get("key2")).toEqual({ value: "value2" });
        expect(db.size).toBe(2);

        // Iterates in write (timestamp) order, as ordered tuples.
        const entries: Array<[string, Value]> = [];
        for await (const entry of db.iterator()) entries.push(entry);
        expect(entries).toEqual([
            ["key1", { value: "value1" }],
            ["key2", { value: "value2" }],
        ]);

        // Merkle layers exist and the head reflects them.
        expect(db.layers.length).toBeGreaterThan(0);
        const head = await db.createHead();
        expect(head.manifest.equals(db.address)).toBe(true);
        expect(head.size).toBe(2);
        expect(head.root).toBeDefined();

        // Head is stable while nothing changes...
        const again = await db.createHead();
        expect(again.cid.equals(head.cid)).toBe(true);

        // ...and the root moves when data changes.
        await db.set("key3", { value: "value3" });
        await drain();
        const after = await db.createHead();
        expect(after.root.equals(head.root)).toBe(false);
        expect(after.size).toBe(3);

        await db.close();
    });

    // KNOWN_ISSUES.md #18 — falsy values (0, "", false, null) are legitimate
    // values but iterator() drops them via `if (value) yield`. They must survive
    // a round-trip through the ordered iterator.
    it("iterates over falsy values instead of dropping them", async () => {
        const syncController = (await createSyncController("db-falsy", heliaController)) as SyncController;
        const db = await createDenkmitDatabase<number>("db-falsy", {
            helia: node.helia,
            identity: node.identity,
            syncController,
        });
        await db.set("zero", 0);
        await db.set("one", 1);
        await syncController.queue.onIdle();

        const entries: Array<[string, number]> = [];
        for await (const entry of db.iterator()) entries.push(entry);

        expect(entries).toEqual([
            ["zero", 0],
            ["one", 1],
        ]);
        await db.close();
    });
});
