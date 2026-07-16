import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDenkmitDatabase, createIdentity, HeliaController } from "../src/functions";
import { IdentityInterface } from "../src/types";
import { buildHead, createTestNode, ForgedLeaf, putSignedEntry, TestNode } from "./helpers";

type Value = { value: string };

/**
 * KNOWN_ISSUES.md D6: merge/load verifies an identity per foreign entry. The
 * HeliaController now caches resolved identities (bounded LRU + in-flight
 * coalescing), so many entries from the same writer trigger a single fetch+verify.
 */
describe("Identity cache (D6)", () => {
    let node: TestNode; // identity A (creator)
    let other: IdentityInterface; // identity B (foreign writer)

    beforeAll(async () => {
        node = await createTestNode("id-cache-owner");
        other = await createIdentity("id-cache-other", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("verifies a repeated foreign writer's identity only once", async () => {
        // Public database so B's entries are authorized; A merges them.
        const db = await createDenkmitDatabase<Value>("id-cache", {
            helia: node.helia,
            identity: node.identity,
            publicWrite: true,
        });
        const bController = new HeliaController(node.helia, other);

        const count = 6;
        const base = Date.now();
        const leaves: ForgedLeaf[] = [];
        for (let i = 0; i < count; i++) {
            const entry = await putSignedEntry(bController, `k${i}`, { value: `v${i}` }, base + i);
            leaves.push({ cid: entry.cid, creator: entry.creator, sort: [entry.timestamp], key: entry.key });
        }
        const head = await buildHead(bController, db.address, leaves);

        const dbController = db.heliaController as HeliaController;
        const before = dbController.identityFetchCount;

        await db.syncNewHead(head.cid.bytes);
        await db.idle();

        expect(db.size).toBe(count);
        // B's identity is fetched+verified exactly once for the whole head + all
        // entries, not once per entry.
        expect(dbController.identityFetchCount - before).toBe(1);

        await db.close();
    });
});
