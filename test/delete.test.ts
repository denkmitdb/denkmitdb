import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createIdentity,
    createTombstone,
    HeliaController,
    openDenkmitDatabase,
} from "../src/functions";
import { IdentityInterface } from "../src/types";
import { buildHead, createTestNode, TestNode } from "./helpers";

type Value = { value: string };

/**
 * Delete via logical tombstones (D7, specs/ordering.md): a signed delete record in
 * the same composite LWW order as puts. A winning tombstone hides the key; a newer
 * put resurrects it; the record stays in the Merkle tree; no GC.
 */
describe("Delete (tombstones)", () => {
    let node: TestNode;
    let other: IdentityInterface;

    beforeAll(async () => {
        node = await createTestNode("delete-owner");
        other = await createIdentity("delete-other", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("hides a deleted key from get and iterator; record stays in the tree", async () => {
        const db = await createDenkmitDatabase<Value>("del-basic", {
            helia: node.helia,
            identity: node.identity,
        });
        await db.set("keep", { value: "stays" });
        await db.set("gone", { value: "temporary" });
        await db.idle();
        expect(db.size).toBe(2);

        await db.delete("gone");
        await db.idle();

        expect(await db.get("gone")).toBeUndefined();
        const entries: Array<[string, Value]> = [];
        for await (const e of db.iterator()) entries.push(e);
        expect(entries).toEqual([["keep", { value: "stays" }]]);

        // `size` counts Merkle records (including the tombstone), matching head.size.
        expect(db.size).toBe(2);
        await db.close();
    });

    it("a newer set resurrects a deleted key", async () => {
        const db = await createDenkmitDatabase<Value>("del-resurrect", {
            helia: node.helia,
            identity: node.identity,
        });
        await db.set("k", { value: "v1" });
        await db.delete("k");
        await db.idle();
        expect(await db.get("k")).toBeUndefined();

        await db.set("k", { value: "v2" });
        await db.idle();
        expect(await db.get("k")).toEqual({ value: "v2" });
        expect(db.size).toBe(1); // put superseded the tombstone record
        await db.close();
    });

    it("replicates a delete to a peer replica of the same database", async () => {
        const nodeB = await createTestNode("delete-peer");
        try {
            const { connectNodes } = await import("./helpers");
            await connectNodes(node, nodeB);

            const dbA = await createDenkmitDatabase<Value>("del-repl", {
                helia: node.helia,
                identity: node.identity,
            });
            await dbA.set("doomed", { value: "x" });
            await dbA.set("kept", { value: "y" });
            await dbA.idle();

            const dbB = await openDenkmitDatabase<Value>(dbA.address, {
                helia: nodeB.helia,
                identity: nodeB.identity,
            });

            // Announce only after both sides see each other on the topic, so the
            // test doesn't depend on the 30 s periodic re-announcement.
            const { waitFor } = await import("./helpers");
            const { syncTopic } = await import("../src/functions");
            const topic = syncTopic(dbA.address);
            await waitFor(
                () =>
                    node.helia.libp2p.services.pubsub.getSubscribers(topic).length > 0 &&
                    nodeB.helia.libp2p.services.pubsub.getSubscribers(topic).length > 0,
                { message: "pubsub subscription for the delete-replication topic" },
            );

            await dbA.announceHead();
            await waitFor(() => dbB.size === 2, { message: "peer to receive initial state" });
            expect(await dbB.get("doomed")).toEqual({ value: "x" });

            await dbA.delete("doomed");
            await dbA.idle();
            await dbA.announceHead();

            await waitFor(async () => (await dbB.get("doomed")) === undefined, {
                message: "peer to converge on the delete",
            });
            expect(await dbB.get("kept")).toEqual({ value: "y" });

            const headA = await dbA.createHead();
            const headB = await dbB.createHead();
            expect(headB.root.equals(headA.root)).toBe(true);

            await dbA.close();
            await dbB.close();
        } finally {
            await nodeB.stop();
        }
    }, 60_000);

    it("rejects an unauthorized tombstone locally and through merge", async () => {
        // Creator-only database: B cannot delete, locally or via a crafted head.
        const db = await createDenkmitDatabase<Value>("del-authz", {
            helia: node.helia,
            identity: node.identity,
        });
        await db.set("target", { value: "protected" });
        await db.idle();

        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });
        await expect(dbAsB.delete("target")).rejects.toThrow(/access denied/i);
        await dbAsB.close();

        // Merge path: a head containing B's tombstone for the key must not apply it.
        const bController = new HeliaController(node.helia, other);
        const tomb = await createTombstone<Value>("target", bController);
        const head = await buildHead(bController, db.address, [
            { cid: tomb.cid, creator: tomb.creator, sort: [tomb.timestamp], key: "target" },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await db.idle();

        expect(await db.get("target")).toEqual({ value: "protected" });
        await db.close();
    });

    it("a delete survives reopen from the persisted head", async () => {
        const db = await createDenkmitDatabase<Value>("del-persist", {
            helia: node.helia,
            identity: node.identity,
        });
        const address = db.address;
        await db.set("a", { value: "1" });
        await db.set("b", { value: "2" });
        await db.delete("a");
        await db.idle();
        await db.createHead(); // persist the pointer
        await db.close();

        const reopened = await openDenkmitDatabase<Value>(address, {
            helia: node.helia,
            identity: node.identity,
        });
        await reopened.idle();

        expect(await reopened.get("a")).toBeUndefined();
        expect(await reopened.get("b")).toEqual({ value: "2" });
        await reopened.close();
    });
});
