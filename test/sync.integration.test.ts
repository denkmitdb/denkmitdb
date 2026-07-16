import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createSyncController,
    openDenkmitDatabase,
    HeliaController,
    SyncController,
} from "../src/functions";
import { DenkmitDatabaseInterface } from "../src/types";
import { connectNodes, createTestNode, TestNode, waitFor } from "./helpers";

type Value = { value: string };

const TOPIC = "sync-test";

describe("Two-node synchronization", () => {
    let nodeA: TestNode;
    let nodeB: TestNode;
    let syncA: SyncController;
    let dbA: DenkmitDatabaseInterface<Value>;
    let dbB: DenkmitDatabaseInterface<Value>;

    beforeAll(async () => {
        nodeA = await createTestNode("node-a");
        nodeB = await createTestNode("node-b");
        await connectNodes(nodeA, nodeB);

        const heliaControllerA = new HeliaController(nodeA.helia, nodeA.identity);
        syncA = (await createSyncController(TOPIC, heliaControllerA)) as SyncController;
        dbA = await createDenkmitDatabase<Value>(TOPIC, {
            helia: nodeA.helia,
            identity: nodeA.identity,
            syncController: syncA,
        });

        // Node B opens the database by its address; the manifest travels over bitswap.
        dbB = await openDenkmitDatabase<Value>(dbA.address, {
            helia: nodeB.helia,
            identity: nodeB.identity,
        });
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
        expect(manifestB.name).toBe(TOPIC);
    });

    it("replicates entries from node A to node B after a head announcement", { timeout: 60_000 }, async () => {
        // Wait until both sides see each other subscribed to the pubsub topic.
        await waitFor(
            () => {
                const subsA = nodeA.helia.libp2p.services.pubsub.getSubscribers(TOPIC);
                const subsB = nodeB.helia.libp2p.services.pubsub.getSubscribers(TOPIC);
                return subsA.length > 0 && subsB.length > 0;
            },
            { message: "pubsub subscription for the sync topic" },
        );

        await dbA.set("greeting", { value: "hello from A" });
        await dbA.set("farewell", { value: "bye from A" });
        await syncA.queue.onIdle();

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
