import { floodsub } from "@libp2p/floodsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createHelia } from "helia";
import { createLibp2p, Libp2p } from "libp2p";
import { CID } from "multiformats/cid";
import {
    createEmptyPollard,
    createHead,
    createIdentity,
    HeliaController,
} from "../src/functions";
import {
    EntryData,
    ENTRY_VERSION,
    HeadInterface,
    HEAD_VERSION,
    IdentityInterface,
    LeafTypes,
} from "../src/types";
import type { DenkmitHeliaInterface } from "../src/types";

export type TestNode = {
    helia: DenkmitHeliaInterface;
    identity: IdentityInterface;
    stop: () => Promise<void>;
};

/**
 * Spins up a Helia node backed by in-memory block/data stores and a TCP
 * libp2p transport bound to localhost, plus a fresh identity.
 */
export async function createTestNode(name: string): Promise<TestNode> {
    const libp2p = await createLibp2p({
        addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: {
            identify: identify(),
            pubsub: floodsub({ emitSelf: true }),
        },
    });
    const helia = (await createHelia({ libp2p })) as unknown as DenkmitHeliaInterface;
    const identity = await createIdentity(name, "test-passphrase", helia);

    return {
        helia,
        identity,
        stop: async () => {
            await helia.stop();
            await libp2p.stop();
        },
    };
}

/** Connects two test nodes directly by multiaddr. */
export async function connectNodes(a: TestNode, b: TestNode): Promise<void> {
    const libp2pA = a.helia.libp2p as unknown as Libp2p;
    const libp2pB = b.helia.libp2p as unknown as Libp2p;
    await libp2pA.dial(libp2pB.getMultiaddrs());
}

/**
 * A signed entry block written directly through the HeliaController, with a
 * caller-chosen timestamp/key/value. Used to forge or backdate entries that
 * `createEntry` (which stamps `Date.now()`) can't produce.
 */
export async function putSignedEntry<T>(
    heliaController: HeliaController,
    key: string,
    value: T,
    timestamp: number,
): Promise<{ cid: CID; creator: CID; timestamp: number; key: string }> {
    const data: EntryData<T> = { version: ENTRY_VERSION, timestamp, key, value };
    const signed = await heliaController.addSignedV2(data);
    return { cid: signed.cid, creator: signed.creator, timestamp, key };
}

/** A leaf to place in a forged head: what CID/creator/sort-key/key to claim. */
export type ForgedLeaf = { cid: CID; creator: CID; sort: number[]; key: string };

/**
 * Builds and signs a single-pollard head over the given leaves, binding it to
 * `manifest`. This is the raw shape a peer publishes; feeding it to
 * `db.syncNewHead(head.cid.bytes)` exercises the real ingestion path, letting
 * tests inject metadata that disagrees with the signed entries it links to.
 */
export async function buildHead(
    heliaController: HeliaController,
    manifest: CID,
    leaves: ForgedLeaf[],
    order = 3,
): Promise<HeadInterface> {
    const pollard = await createEmptyPollard(order);
    for (const leaf of leaves) {
        await pollard.append(LeafTypes.SortedEntry, leaf.cid, leaf.creator, leaf.sort, leaf.key);
    }
    await pollard.updateLayers();
    await heliaController.add(pollard.toJSON());
    const root = await pollard.getCID();

    return createHead(
        {
            version: HEAD_VERSION,
            manifest,
            root,
            timestamp: leaves.reduce((max, l) => Math.max(max, l.sort[0] ?? 0), 0) + 1,
            layers: 1,
            size: leaves.length,
        },
        heliaController,
    );
}

/** Polls `condition` until it returns true or `timeout` ms elapse. */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    { timeout = 30_000, interval = 100, message = "condition" }: { timeout?: number; interval?: number; message?: string } = {},
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error(`Timed out after ${timeout}ms waiting for ${message}`);
}
