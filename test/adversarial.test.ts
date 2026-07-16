import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createSyncController,
    emptyCID,
    HeliaController,
    SyncController,
} from "../src/functions";
import { DenkmitDatabaseInterface } from "../src/types";
import { buildHead, createTestNode, putSignedEntry, TestNode } from "./helpers";

/**
 * These tests encode the Phase 1 spec (specs/ordering.md) and the replication
 * trust requirements (KNOWN_ISSUES.md #1, #2, #10, #11). They were written as
 * `it.fails` acceptance pins in Phase 1 and flipped to normal tests in Phase 2 as
 * the fixes landed; they now guard against regressions.
 *
 * Each case builds its own database so failures are independent.
 */
describe("Adversarial replication (Phase 2 acceptance pins)", () => {
    let node: TestNode;
    let heliaController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("adversarial");
        heliaController = new HeliaController(node.helia, node.identity);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    async function createDb(name: string) {
        const syncController = (await createSyncController(name, heliaController)) as SyncController;
        const db = await createDenkmitDatabase<unknown>(name, {
            helia: node.helia,
            identity: node.identity,
            syncController,
        });
        const drain = async () => {
            // syncNewHead enqueues the fetch+merge; wait for it to settle.
            let prev = -1;
            while (syncController.queue.size + syncController.queue.pending !== prev) {
                prev = syncController.queue.size + syncController.queue.pending;
                await syncController.queue.onIdle();
            }
        };
        return { db: db as DenkmitDatabaseInterface<unknown>, drain };
    }

    // KNOWN_ISSUES.md #11 — a head bound to a different manifest must not mutate
    // this database's state. syncNewHead currently loads it unconditionally.
    it("rejects a head bound to a foreign manifest", async () => {
        const { db, drain } = await createDb("foreign-head");
        const foreignManifest = await emptyCID();
        const entry = await putSignedEntry(heliaController, "intruder", { value: "x" }, Date.now());
        const foreignHead = await buildHead(heliaController, foreignManifest, [
            { cid: entry.cid, creator: entry.creator, sort: [entry.timestamp], key: entry.key },
        ]);

        await db.syncNewHead(foreignHead.cid.bytes);
        await drain();

        expect(db.size).toBe(0);
        await db.close();
    });

    // KNOWN_ISSUES.md #10 — the merge path indexes leaf metadata without checking
    // it against the signed entry. Here the leaf claims key "forged" while the
    // signed entry's key is "legit"; an authenticated merge must index under the
    // signed key (or reject), never under the attacker's claim.
    it("does not index an entry under a key the signed entry does not carry", async () => {
        const { db, drain } = await createDb("forged-key");
        const manifest = (await db.getManifest()).cid;
        const entry = await putSignedEntry(heliaController, "legit", { value: "real" }, Date.now());

        const forgedHead = await buildHead(heliaController, manifest, [
            { cid: entry.cid, creator: entry.creator, sort: [entry.timestamp], key: "forged" },
        ]);
        await db.syncNewHead(forgedHead.cid.bytes);
        await drain();

        const keys: string[] = [];
        for await (const [key] of db.iterator()) keys.push(key);

        expect(keys).not.toContain("forged");
        expect(keys).toContain("legit");
        await db.close();
    });

    // KNOWN_ISSUES.md #1 + #2 — a merged entry with a strictly newer composite key
    // must win and become visible, despite a value already cached locally for that
    // key. Today get() returns the stale cached value and the old record lingers.
    it("a newer merged entry wins and invalidates the cached value", async () => {
        const { db, drain } = await createDb("lww-newer");
        const manifest = (await db.getManifest()).cid;

        await db.set("k", { value: "v1" });
        await drain();
        expect(await db.get("k")).toEqual({ value: "v1" }); // now cached

        const base = Date.now();
        const newer = await putSignedEntry(heliaController, "k", { value: "v2" }, base + 10_000);
        const head = await buildHead(heliaController, manifest, [
            { cid: newer.cid, creator: newer.creator, sort: [newer.timestamp], key: "k" },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await drain();

        expect(await db.get("k")).toEqual({ value: "v2" });
        expect(db.size).toBe(1); // exactly one live record for the key
        await db.close();
    });

    // KNOWN_ISSUES.md #2 — an OLDER merged entry must lose to the value already
    // present for the key (last-write-wins by composite key, not by merge order).
    it("an older merged entry loses to the newer local value", async () => {
        const { db, drain } = await createDb("lww-older");
        const manifest = (await db.getManifest()).cid;

        const base = Date.now();
        await db.set("k", { value: "new" }); // stamped ~base
        await drain();

        const older = await putSignedEntry(heliaController, "k", { value: "old" }, base - 10_000);
        const head = await buildHead(heliaController, manifest, [
            { cid: older.cid, creator: older.creator, sort: [older.timestamp], key: "k" },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await drain();

        expect(await db.get("k")).toEqual({ value: "new" });
        expect(db.size).toBe(1);
        await db.close();
    });
});
