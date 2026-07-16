import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDenkmitDatabase, openDenkmitDatabase, syncTopic } from "../src/functions";
import { DenkmitDatabaseInterface } from "../src/types";
import { connectNodes, createTestNode, TestNode, waitFor } from "./helpers";

type Value = { value: string };

const NAME = "sync-test";

describe("Two-node synchronization", () => {
    let nodeA: TestNode;
    let nodeB: TestNode;
    let dbA: DenkmitDatabaseInterface<Value>;
    let dbB: DenkmitDatabaseInterface<Value>;
    let topic: string;

    beforeAll(async () => {
        nodeA = await createTestNode("node-a");
        nodeB = await createTestNode("node-b");
        await connectNodes(nodeA, nodeB);

        dbA = await createDenkmitDatabase<Value>(NAME, { helia: nodeA.helia, identity: nodeA.identity });

        // Node B opens the database by its address; the manifest travels over bitswap.
        dbB = await openDenkmitDatabase<Value>(dbA.address, { helia: nodeB.helia, identity: nodeB.identity });

        // The sync topic is derived from the manifest CID (D5), not the name.
        topic = syncTopic(dbA.address);
    }, 60_000);

    afterAll(async () => {
        await dbA.close();
        await dbB.close();
        await nodeA.stop();
        await nodeB.stop();
    });

    it("opens the same database on a second node via its address", async () => {
        const manifestB = await dbB.getManifest();
        expect(manifestB.cid.equals(dbA.address)).toBe(true);
        expect(manifestB.name).toBe(NAME);
    });

    it("syncs on a manifest-CID-derived topic, not the name", () => {
        expect(topic).toBe(`/denkmitdb/2/${dbA.address.toString()}`);
        expect(topic).not.toContain(NAME);
    });

    it("replicates entries from node A to node B after a head announcement", { timeout: 60_000 }, async () => {
        // Wait until both sides see each other subscribed to the pubsub topic.
        await waitFor(
            () => {
                const subsA = nodeA.helia.libp2p.services.pubsub.getSubscribers(topic);
                const subsB = nodeB.helia.libp2p.services.pubsub.getSubscribers(topic);
                return subsA.length > 0 && subsB.length > 0;
            },
            { message: "pubsub subscription for the sync topic" },
        );

        await dbA.set("greeting", { value: "hello from A" });
        await dbA.set("farewell", { value: "bye from A" });
        await dbA.idle();

        await dbA.sendHead();

        await waitFor(() => dbB.size === 2, { message: "node B to merge the announced head" });

        expect(await dbB.get("greeting")).toEqual({ value: "hello from A" });
        expect(await dbB.get("farewell")).toEqual({ value: "bye from A" });

        // Both replicas converge on the same Merkle root.
        const headA = await dbA.createHead();
        const headB = await dbB.createHead();
        expect(headB.root.equals(headA.root)).toBe(true);
    });
});

/**
 * KNOWN_ISSUES.md #21: heads are only announced when the root *changes*
 * (`sendHead()` is gated on `createOnlyNewHead()`), so a peer that connects after
 * the last change never learns the head. `announceHead()` re-announces the current
 * head unconditionally, which is what the periodic sync task now calls.
 */
describe("Late-joiner head re-announcement (#21)", () => {
    let nodeA: TestNode;
    let nodeB: TestNode;
    let dbA: DenkmitDatabaseInterface<Value>;
    let dbB: DenkmitDatabaseInterface<Value>;
    let topic: string;

    beforeAll(async () => {
        nodeA = await createTestNode("late-a");
        nodeB = await createTestNode("late-b");
        await connectNodes(nodeA, nodeB);

        dbA = await createDenkmitDatabase<Value>("late-join-test", {
            helia: nodeA.helia,
            identity: nodeA.identity,
        });
        topic = syncTopic(dbA.address);

        // Node A writes and builds its head. It never calls sendHead(), and the 30 s
        // periodic task won't fire during the test, so no announcement goes out.
        await dbA.set("k1", { value: "v1" });
        await dbA.set("k2", { value: "v2" });
        await dbA.idle();
        await dbA.createHead(); // fix the root; a later sendHead() is a no-op

        // Node B is the late joiner — it opens and subscribes only now, after A's
        // (unsent) head already exists.
        dbB = await openDenkmitDatabase<Value>(dbA.address, {
            helia: nodeB.helia,
            identity: nodeB.identity,
        });

        await waitFor(
            () => {
                const subsA = nodeA.helia.libp2p.services.pubsub.getSubscribers(topic);
                const subsB = nodeB.helia.libp2p.services.pubsub.getSubscribers(topic);
                return subsA.length > 0 && subsB.length > 0;
            },
            { message: "pubsub subscription for the late-join topic" },
        );
    }, 60_000);

    afterAll(async () => {
        await dbA.close();
        await dbB.close();
        await nodeA.stop();
        await nodeB.stop();
    });

    it("change-gated sendHead() leaves a late joiner empty (the bug)", { timeout: 60_000 }, async () => {
        // Root is unchanged since the head was built, so sendHead() publishes nothing.
        await dbA.sendHead();
        // Give any (non-existent) message time to arrive; the joiner must stay empty.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        expect(dbB.size).toBe(0);
    });

    it("announceHead() re-announces so the late joiner converges", { timeout: 60_000 }, async () => {
        await dbA.announceHead();
        await waitFor(() => dbB.size === 2, { message: "late joiner to converge after re-announcement" });

        expect(await dbB.get("k1")).toEqual({ value: "v1" });
        expect(await dbB.get("k2")).toEqual({ value: "v2" });
        const headA = await dbA.createHead();
        const headB = await dbB.createHead();
        expect(headB.root.equals(headA.root)).toBe(true);
    });
});
