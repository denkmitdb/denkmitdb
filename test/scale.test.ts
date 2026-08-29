import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDenkmitDatabase, openDenkmitDatabase, syncTopic } from "../src/functions";
import { DenkmitDatabaseInterface } from "../src/types";
import { connectNodes, createTestNode, TestNode, waitFor } from "./helpers";

type Value = { n: number };

/**
 * Every other structural test in this suite fits inside a single pollard, which is
 * exactly the region where the tree rebuild was already correct. These tests push
 * past the pollard boundaries so `updateLayers` has to build a tree three layers
 * deep — the case that used to alias one layer's accumulator into the next and
 * produce a self-referential pollard block that pinning never finished walking.
 */
describe("Multi-layer trees", () => {
    let node: TestNode;

    beforeAll(async () => {
        node = await createTestNode("scale-node");
    }, 60_000);

    afterAll(async () => {
        await node.stop();
    });

    it("builds a three-layer tree at the default order without stalling", { timeout: 120_000 }, async () => {
        // Default order 3 => 8 entries per pollard, so 65 entries is the first count
        // that needs a third layer.
        const db = await createDenkmitDatabase<Value>("scale-default-order", {
            helia: node.helia,
            identity: node.identity,
        });
        const count = 100;

        for (let i = 0; i < count; i++) {
            await db.set(`key-${i}`, { n: i });
        }
        await db.idle();

        expect(db.size).toBe(count);
        expect(db.layers.length).toBeGreaterThanOrEqual(3);

        // Every layer above the leaves holds one pollard per 2**order below it.
        const layers = db.layers;
        for (let i = 1; i < layers.length; i++) {
            expect(layers[i].length).toBe(Math.ceil(layers[i - 1].length / 2 ** db.order));
        }
        // The tree terminates in a single root pollard.
        expect(layers[layers.length - 1].length).toBe(1);

        // No pollard object is shared between layers: the aliasing bug put the same
        // instance in two layers and appended its own CID into it.
        const seen = new Set<unknown>();
        for (const layer of layers) {
            for (const pollard of layer) {
                expect(seen.has(pollard)).toBe(false);
                seen.add(pollard);
            }
        }

        const head = await db.createHead();
        expect(head.size).toBe(count);
        expect(head.layers).toBe(layers.length);

        for (let i = 0; i < count; i++) {
            expect(await db.get(`key-${i}`)).toEqual({ n: i });
        }

        await db.close();
    });

    it("builds a four-layer tree at order 2", { timeout: 120_000 }, async () => {
        // Order 2 => 4 entries per pollard, so the tree deepens fastest here: 17
        // entries already need three layers, 65 need four.
        const db = await createDenkmitDatabase<Value>("scale-order-2", {
            helia: node.helia,
            identity: node.identity,
            order: 2,
        });

        for (let i = 0; i < 80; i++) {
            await db.set(`key-${i}`, { n: i });
        }
        await db.idle();

        expect(db.size).toBe(80);
        const layers = db.layers;
        expect(layers.length).toBe(4);
        expect(layers[layers.length - 1].length).toBe(1);

        const seen = new Set<unknown>();
        for (const layer of layers) {
            for (const pollard of layer) {
                expect(seen.has(pollard)).toBe(false);
                seen.add(pollard);
            }
        }

        for (let i = 0; i < 80; i++) {
            expect(await db.get(`key-${i}`)).toEqual({ n: i });
        }

        await db.close();
    });
});

/**
 * Merkle-diffing a tree deeper than one pollard is the project's central claim, and
 * `compareNodes` recurses through the intermediate layers only when a tree actually
 * has them. This is that path end to end, over real libp2p.
 */
describe("Two-node synchronization of a multi-layer tree", () => {
    let nodeA: TestNode;
    let nodeB: TestNode;
    let dbA: DenkmitDatabaseInterface<Value>;
    let dbB: DenkmitDatabaseInterface<Value>;

    beforeAll(async () => {
        nodeA = await createTestNode("scale-a");
        nodeB = await createTestNode("scale-b");
        await connectNodes(nodeA, nodeB);

        dbA = await createDenkmitDatabase<Value>("scale-sync", { helia: nodeA.helia, identity: nodeA.identity });
        dbB = await openDenkmitDatabase<Value>(dbA.address, { helia: nodeB.helia, identity: nodeB.identity });
    }, 60_000);

    afterAll(async () => {
        await dbA.close();
        await dbB.close();
        await nodeA.stop();
        await nodeB.stop();
    });

    it("replicates a three-layer tree and converges on the same root", { timeout: 180_000 }, async () => {
        const topic = syncTopic(dbA.address);
        await waitFor(
            () =>
                nodeA.helia.libp2p.services.pubsub.getSubscribers(topic).length > 0 &&
                nodeB.helia.libp2p.services.pubsub.getSubscribers(topic).length > 0,
            { message: "pubsub subscription for the sync topic" },
        );

        const count = 100;
        for (let i = 0; i < count; i++) {
            await dbA.set(`key-${i}`, { n: i });
        }
        await dbA.idle();
        expect(dbA.layers.length).toBeGreaterThanOrEqual(3);

        await dbA.sendHead();

        await waitFor(() => dbB.size === count, {
            timeout: 120_000,
            message: `node B to merge all ${count} entries`,
        });
        await dbB.idle();

        const headA = await dbA.createHead();
        const headB = await dbB.createHead();
        expect(headB.root.equals(headA.root)).toBe(true);
        expect(headB.layers).toBe(headA.layers);

        expect(await dbB.get("key-0")).toEqual({ n: 0 });
        expect(await dbB.get("key-99")).toEqual({ n: 99 });
    });
});
