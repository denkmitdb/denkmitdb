import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import {
    createDenkmitDatabase,
    createIdentity,
    hasIdentity,
    openDenkmitDatabase,
    openIdentity,
} from "@denkmitdb/denkmitdb";
import type { DenkmitDatabaseInterface, DenkmitHeliaInterface, IdentityInterface } from "@denkmitdb/denkmitdb";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import { FsBlockstore } from "blockstore-fs";
import { FsDatastore } from "datastore-fs";
import { createHelia } from "helia";
import { createLibp2p } from "libp2p";
import { CID } from "multiformats/cid";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type MemoryValue = unknown;

export type MemoryNode = {
    helia: DenkmitHeliaInterface;
    identity: IdentityInterface;
    db: DenkmitDatabaseInterface<MemoryValue>;
    created: boolean;
    stop: () => Promise<void>;
};

export type MemoryNodeConfig = {
    /** Data directory root; each identity gets its own subdirectory. */
    dataDir: string;
    /** Identity name; also namespaces the data directory. */
    identityName: string;
    /** Passphrase encrypting the identity's private key at rest. */
    passphrase: string;
    /** Database address to open. Absent: create (or reopen the one created before). */
    databaseAddress?: string;
    /** Database name when creating. */
    databaseName: string;
    /** Whether a created database accepts writes from any identity. */
    publicWrite: boolean;
    /** Multiaddrs to dial for sync (mdns also discovers local peers automatically). */
    peers: string[];
};

export function configFromEnv(env: NodeJS.ProcessEnv): MemoryNodeConfig {
    return {
        dataDir: env.DENKMIT_DATADIR ?? join(homedir(), ".denkmit-mcp"),
        identityName: env.DENKMIT_IDENTITY ?? "agent",
        passphrase: env.DENKMIT_PASSPHRASE ?? "denkmit-dev-passphrase",
        databaseAddress: env.DENKMIT_DB || undefined,
        databaseName: env.DENKMIT_DB_NAME ?? "agent-memory",
        publicWrite: env.DENKMIT_PUBLIC_WRITE === "true",
        peers: (env.DENKMIT_PEERS ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    };
}

/**
 * Boots a persistent DenkMitDB node: filesystem block/data stores (so identity,
 * blocks, and the D4 head pointer survive restarts), a TCP libp2p with mdns local
 * peer discovery and floodsub, and the memory database itself — opened by address
 * when configured, otherwise created once and its address remembered on disk.
 */
export async function startMemoryNode(config: MemoryNodeConfig): Promise<MemoryNode> {
    const dir = join(config.dataDir, config.identityName);
    await mkdir(dir, { recursive: true });

    const libp2p = await createLibp2p({
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [mdns()],
        services: {
            identify: identify(),
            pubsub: floodsub({ emitSelf: true }),
        },
    });

    const helia = (await createHelia({
        libp2p,
        blockstore: new FsBlockstore(join(dir, "blocks")),
        datastore: new FsDatastore(join(dir, "data")),
    })) as unknown as DenkmitHeliaInterface;

    const identity = (await hasIdentity(config.identityName, helia))
        ? await openIdentity(config.identityName, config.passphrase, helia)
        : await createIdentity(config.identityName, config.passphrase, helia);

    const { multiaddr } = await import("@multiformats/multiaddr");

    for (const peer of config.peers) {
        try {
            await libp2p.dial(multiaddr(peer));
        } catch (error) {
            console.error(`[denkmit-mcp] failed to dial ${peer}:`, (error as Error).message);
        }
    }

    // Same-machine rendezvous: advertise our listen addresses under the shared data
    // root and dial every sibling identity's advertised addresses. This makes agents
    // sharing DENKMIT_DATADIR find each other even where mdns multicast is blocked
    // (containers, locked-down hosts); dial failures (stale files, dead peers) are
    // ignored. Re-scans periodically because sibling servers may start later or
    // restart on new ports.
    await writeFile(
        join(dir, "addrs.json"),
        JSON.stringify({ addrs: libp2p.getMultiaddrs().map(String), updatedAt: Date.now() }),
    );
    const dialSiblings = async (): Promise<void> => {
        let siblings: string[] = [];
        try {
            siblings = (await readdir(config.dataDir)).filter((name) => name !== config.identityName);
        } catch {
            return;
        }
        for (const sibling of siblings) {
            try {
                const raw = await readFile(join(config.dataDir, sibling, "addrs.json"), "utf8");
                const { addrs } = JSON.parse(raw) as { addrs: string[] };
                for (const addr of addrs) {
                    await libp2p.dial(multiaddr(addr)).catch(() => {});
                }
            } catch {
                // sibling has no addr file (yet) — fine
            }
        }
    };
    await dialSiblings();
    const rendezvousTimer = setInterval(() => void dialSiblings(), 15_000);
    rendezvousTimer.unref();

    // Resolve the database address: explicit env > remembered from a previous
    // create > create fresh and remember.
    const addressFile = join(dir, "database-address");
    let address = config.databaseAddress;
    let created = false;
    if (!address) {
        address = await readFile(addressFile, "utf8").then(
            (s) => s.trim(),
            () => undefined,
        );
    }

    let db: DenkmitDatabaseInterface<MemoryValue>;
    if (address) {
        db = await openDenkmitDatabase<MemoryValue>(CID.parse(address), { helia, identity });
    } else {
        db = await createDenkmitDatabase<MemoryValue>(config.databaseName, {
            helia,
            identity,
            publicWrite: config.publicWrite,
        });
        await writeFile(addressFile, db.address.toString());
        created = true;
    }

    return {
        helia,
        identity,
        db,
        created,
        stop: async () => {
            clearInterval(rendezvousTimer);
            await db.close();
            await helia.stop();
            await libp2p.stop();
        },
    };
}
