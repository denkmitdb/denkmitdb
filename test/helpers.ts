import { floodsub } from "@libp2p/floodsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCborCodec from "@ipld/dag-cbor";
import { createHeliaLight } from "helia";
import { Libp2p } from "libp2p";
import { CID } from "multiformats/cid";
import type { PolicyRule } from "../src/internal";
import {
    createEmptyPollard,
    createHead,
    createIdentity,
    createManifest,
    createPolicy,
    HeliaController,
    openDatabase,
} from "../src/internal";
import {
    DenkmitDatabase,
    EntryPayload,
    ENTRY_VERSION,
    Head,
    HEAD_VERSION,
    SigningIdentity,
    LeafKind,
    LEGACY_ENTRY_VERSION,
    MANIFEST_VERSION,
} from "../src/internal";
import type { HeliaNode, ManifestPayload } from "../src/internal";

export type TestNode = {
    helia: HeliaNode;
    identity: SigningIdentity;
    stop: () => Promise<void>;
};

/**
 * Spins up a Helia node backed by in-memory block/data stores and a TCP
 * libp2p transport bound to localhost, plus a fresh identity.
 */
export async function createTestNode(name: string): Promise<TestNode> {
    // helia 7 shape: a light Helia (in-memory stores, dag-cbor codec) with the
    // libp2p and bitswap mixins layered on. `withLibp2pLight` takes the exact
    // libp2p config (no defaults merged) and exposes it as `helia.libp2p`;
    // `helia.start()`/`stop()` manage the embedded libp2p.
    const node = withBitswap(
        withLibp2pLight(createHeliaLight({ codecs: [dagCborCodec] }), {
            addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
            transports: [tcp()],
            connectionEncrypters: [noise()],
            streamMuxers: [yamux()],
            services: {
                identify: identify(),
                pubsub: floodsub({ emitSelf: true }),
            },
        }),
    );
    await node.start();
    const helia = node as unknown as HeliaNode;
    const identity = await createIdentity(name, "test-passphrase", helia);

    return {
        helia,
        identity,
        stop: async () => {
            await helia.stop();
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
    manifest?: CID,
): Promise<{ cid: CID; creator: CID; timestamp: number; key: string }> {
    // With a manifest: a current (v2) entry bound to that database. Without one: a
    // legacy v1 entry, which only legacy (v1-manifest) databases accept.
    const data: EntryPayload<T> = manifest
        ? { version: ENTRY_VERSION, manifest, timestamp, key, value }
        : { version: LEGACY_ENTRY_VERSION, timestamp, key, value };
    const signed = await heliaController.addSigned(data);
    return { cid: signed.cid, creator: signed.creator, timestamp, key };
}

/** A signed tombstone (delete) bound to `manifest`, with a caller-chosen timestamp. */
export async function putSignedTombstone(
    heliaController: HeliaController,
    key: string,
    timestamp: number,
    manifest: CID,
): Promise<{ cid: CID; creator: CID; timestamp: number; key: string }> {
    const data: EntryPayload<never> = { version: ENTRY_VERSION, manifest, timestamp, key, deleted: true };
    const signed = await heliaController.addSigned(data);
    return { cid: signed.cid, creator: signed.creator, timestamp, key };
}

/**
 * Creates a database from a hand-built manifest — custom json-logic policies
 * and/or a legacy manifest version that `createDatabase` no longer emits —
 * and opens it through the normal `openDatabase` path.
 */
export async function createCustomDb<T>(
    node: TestNode,
    name: string,
    {
        consensus = true,
        access = { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
        manifestVersion = MANIFEST_VERSION,
        order = 3,
    }: {
        consensus?: unknown;
        access?: unknown;
        manifestVersion?: ManifestPayload["version"];
        order?: number;
    } = {},
): Promise<DenkmitDatabase<T>> {
    const controller = new HeliaController(node.helia, node.identity);
    const policy = (policyName: string, logic: unknown) =>
        createPolicy({ version: 1, name: policyName, description: policyName, logic: logic as PolicyRule }, controller);
    const manifest = await createManifest(
        {
            version: manifestVersion,
            name,
            type: "denkmit-database-key-value",
            order,
            consensus: (await policy(`${name}-consensus`, consensus)).cid,
            access: (await policy(`${name}-access`, access)).cid,
            timestamp: Date.now(),
        },
        controller,
    );
    return openDatabase<T>(manifest.cid, { helia: node.helia, identity: node.identity });
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
): Promise<Head> {
    const pollard = await createEmptyPollard(order);
    for (const leaf of leaves) {
        await pollard.append(LeafKind.SortedEntry, leaf.cid, leaf.creator, leaf.sort, leaf.key);
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
