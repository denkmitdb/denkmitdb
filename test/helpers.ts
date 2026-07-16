import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createHelia } from "helia";
import { createLibp2p, Libp2p } from "libp2p";
import { createIdentity } from "../src/functions";
import type { DenkmitHeliaInterface, IdentityInterface } from "../src/types";

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
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        services: {
            identify: identify(),
            pubsub: gossipsub({ emitSelf: true, allowPublishToZeroTopicPeers: true }),
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
