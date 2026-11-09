import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import {
    createDenkmitDatabase,
    createIdentity,
    hasIdentity,
    openDenkmitDatabase,
    openIdentity,
} from "@denkmitdb/denkmitdb";
import type {
    AccessPreset,
    DenkmitDatabaseInterface,
    DenkmitHeliaInterface,
    IdentityInterface,
    PolicyData,
} from "@denkmitdb/denkmitdb";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCborCodec from "@ipld/dag-cbor";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import { FsBlockstore } from "blockstore-fs";
import { FsDatastore } from "datastore-fs";
import { createHeliaLight } from "helia";
import { CID } from "multiformats/cid";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type MemoryValue = unknown;

export type MemoryNode = {
    helia: DenkmitHeliaInterface;
    identity: IdentityInterface;
    /** Agent identities held by this node (daemon, DENKMIT_AGENTS), by agent name. */
    agents: Map<string, IdentityInterface>;
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
    /** Access preset for a created database (ignored when opening by address). */
    access: AccessPreset;
    /** Largest value memory_set accepts, in UTF-8 bytes of its JSON encoding. */
    maxValueBytes: number;
    /** Multiaddrs to dial for sync (mdns also discovers local peers automatically). */
    peers: string[];
    /** libp2p listen multiaddrs. Embedded default: a random TCP port; daemon: 4001. */
    listen: string[];
    /** Externally reachable multiaddrs to announce instead of the listen ones (NAT, public IP). */
    announce: string[];
    /**
     * JSON file with custom policies for a created database:
     * `{ "accessPolicy"?: PolicyData, "validationPolicy"?: PolicyData }` (docs/policies.md).
     * An accessPolicy here replaces DENKMIT_ACCESS.
     */
    policyFile?: string;
    /** Local-network peer discovery via mDNS (`DENKMIT_MDNS=off` disables it, e.g. on a server). */
    mdns: boolean;
    /**
     * Agents this node holds a separate identity for (`DENKMIT_AGENTS=claude-code,codex`).
     * Each gets its own key, namespace and — in the daemon — its own socket.
     */
    agents: string[];
};

/** TCP port a daemon listens on by default — the conventional libp2p/IPFS swarm port. */
export const DEFAULT_DAEMON_PORT = 4001;

const list = (raw: string | undefined): string[] =>
    (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

const AGENT_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * Checks an agent name: lowercase letters, digits and dashes, at most 32
 * characters — it becomes part of an identity name and a socket file name.
 */
export function assertAgentName(name: string): string {
    if (!AGENT_NAME.test(name)) {
        throw new Error(`Invalid agent name "${name}" (use a-z, 0-9 and "-", at most 32 characters)`);
    }
    return name;
}

/** Reads `DENKMIT_AGENTS` (comma-separated agent names); duplicates are an error. */
export function agentsFromEnv(env: NodeJS.ProcessEnv): string[] {
    const names = list(env.DENKMIT_AGENTS).map(assertAgentName);
    if (new Set(names).size !== names.length) throw new Error("DENKMIT_AGENTS lists an agent twice");
    return names;
}

/** Keychain name of an agent identity: `<node identity>-<agent>`. */
export function agentIdentityName(nodeIdentity: string, agent: string): string {
    return `${nodeIdentity}-${agent}`;
}

/** The socket a daemon serves one agent on, next to its main socket. */
export function agentSocketPath(env: NodeJS.ProcessEnv, agent: string): string {
    return join(dirname(socketPath(env)), `denkmitd-${assertAgentName(agent)}.sock`);
}

/** Where a daemon serves MCP sessions and where thin clients look for it. */
export function socketPath(env: NodeJS.ProcessEnv): string {
    return env.DENKMIT_SOCKET || join(env.DENKMIT_DATADIR ?? join(homedir(), ".denkmit-mcp"), "denkmitd.sock");
}

/**
 * Reads the node configuration from the environment.
 *
 * @param env - The process environment.
 * @param defaults - Deployment defaults: the daemon listens on a fixed port.
 * @returns The configuration.
 */
export function configFromEnv(
    env: NodeJS.ProcessEnv,
    defaults: { listen?: string[] } = {},
): MemoryNodeConfig {
    const listen = list(env.DENKMIT_LISTEN);
    return {
        dataDir: env.DENKMIT_DATADIR ?? join(homedir(), ".denkmit-mcp"),
        identityName: env.DENKMIT_IDENTITY ?? "agent",
        passphrase: env.DENKMIT_PASSPHRASE ?? "", // empty = refuse to start (fail closed)
        databaseAddress: env.DENKMIT_DB || undefined,
        databaseName: env.DENKMIT_DB_NAME ?? "agent-memory",
        access: accessFromEnv(env),
        maxValueBytes: maxValueBytesFromEnv(env),
        peers: list(env.DENKMIT_PEERS),
        listen: listen.length > 0 ? listen : (defaults.listen ?? ["/ip4/0.0.0.0/tcp/0"]),
        announce: list(env.DENKMIT_ANNOUNCE),
        policyFile: env.DENKMIT_POLICY_FILE || undefined,
        mdns: env.DENKMIT_MDNS !== "off",
        agents: agentsFromEnv(env),
    };
}

/** Default value size cap: comfortably above a fact, far below block-size limits. */
export const DEFAULT_MAX_VALUE_BYTES = 64 * 1024;

/**
 * Reads `DENKMIT_MAX_VALUE_BYTES` (default 64 KiB). A malformed value refuses to
 * start rather than silently falling back (KNOWN_ISSUES.md #32).
 *
 * @param env - The process environment.
 * @returns The size cap in bytes.
 */
export function maxValueBytesFromEnv(env: NodeJS.ProcessEnv): number {
    const raw = env.DENKMIT_MAX_VALUE_BYTES?.trim();
    if (!raw) return DEFAULT_MAX_VALUE_BYTES;
    const bytes = Number(raw);
    if (!Number.isSafeInteger(bytes) || bytes < 1) {
        throw new Error(`DENKMIT_MAX_VALUE_BYTES must be a positive integer (got ${raw})`);
    }
    return bytes;
}

/**
 * Reads the access preset for a database this server creates. `DENKMIT_ACCESS` is
 * `creator-only` (default), `public`, `prefix-per-writer`, `namespace-per-writer`, or
 * `allowlist:<identity-cid>,<identity-cid>…`; `DENKMIT_PUBLIC_WRITE=true` is a
 * deprecated alias for `public`. Anything else refuses to start rather than falling
 * back to a different policy — the preset is signed into the manifest for good.
 *
 * @param env - The process environment.
 * @returns The access preset.
 */
export function accessFromEnv(env: NodeJS.ProcessEnv): AccessPreset {
    const raw = env.DENKMIT_ACCESS?.trim();
    const legacyPublic = env.DENKMIT_PUBLIC_WRITE === "true";
    if (!raw) return legacyPublic ? "public" : "creator-only";
    if (legacyPublic && raw !== "public") {
        throw new Error(`DENKMIT_PUBLIC_WRITE=true conflicts with DENKMIT_ACCESS=${raw}`);
    }
    if (raw === "creator-only" || raw === "public" || raw === "prefix-per-writer" || raw === "namespace-per-writer") {
        return raw;
    }
    if (raw.startsWith("allowlist:")) {
        const allowlist = raw
            .slice("allowlist:".length)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return { allowlist };
    }
    throw new Error(
        `Unknown DENKMIT_ACCESS=${raw} (expected creator-only, public, prefix-per-writer, ` +
            "namespace-per-writer, or allowlist:<cid>,…)",
    );
}

/**
 * Reads custom policies for a database this node creates. The library checks
 * each policy's shape before signing it into the manifest.
 *
 * @param path - JSON file with optional `accessPolicy` / `validationPolicy`.
 * @returns The policies found in the file.
 */
async function readPolicyFile(path: string): Promise<{ accessPolicy?: PolicyData; validationPolicy?: PolicyData }> {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const unknownKeys = Object.keys(parsed).filter((k) => k !== "accessPolicy" && k !== "validationPolicy");
    if (unknownKeys.length > 0) {
        throw new Error(`DENKMIT_POLICY_FILE: unexpected keys ${unknownKeys.join(", ")}`);
    }
    return parsed as { accessPolicy?: PolicyData; validationPolicy?: PolicyData };
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

    // helia 7: a light Helia over the filesystem stores with the libp2p and
    // bitswap mixins. withLibp2pLight passes the config verbatim to createLibp2p
    // (defaulting its datastore to Helia's, so the peer store persists too) and
    // exposes the node as helia.libp2p; start()/stop() manage both.
    const node = withBitswap(
        withLibp2pLight(
            createHeliaLight({
                codecs: [dagCborCodec],
                blockstore: new FsBlockstore(join(dir, "blocks")),
                datastore: new FsDatastore(join(dir, "data")),
            }),
            {
                addresses: {
                    listen: config.listen,
                    ...(config.announce.length > 0 ? { announce: config.announce } : {}),
                },
                transports: [tcp()],
                connectionEncrypters: [noise()],
                streamMuxers: [yamux()],
                peerDiscovery: config.mdns ? [mdns()] : [],
                services: {
                    identify: identify(),
                    pubsub: floodsub({ emitSelf: true }),
                },
            },
        ),
    );
    await node.start();
    const helia = node as unknown as DenkmitHeliaInterface;
    const libp2p = helia.libp2p;

    const openOrCreate = async (name: string) =>
        (await hasIdentity(name, helia))
            ? await openIdentity(name, config.passphrase, helia)
            : await createIdentity(name, config.passphrase, helia);
    const identity = await openOrCreate(config.identityName);
    const agents = new Map<string, IdentityInterface>();
    for (const agent of config.agents) {
        agents.set(agent, await openOrCreate(agentIdentityName(config.identityName, agent)));
    }

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
        let siblings: string[];
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
        const custom = config.policyFile ? await readPolicyFile(config.policyFile) : {};
        db = await createDenkmitDatabase<MemoryValue>(config.databaseName, {
            helia,
            identity,
            ...(custom.accessPolicy ? { accessPolicy: custom.accessPolicy } : { access: config.access }),
            ...(custom.validationPolicy ? { validationPolicy: custom.validationPolicy } : {}),
        });
        await writeFile(addressFile, db.address.toString());
        created = true;
    }

    return {
        helia,
        identity,
        agents,
        db,
        created,
        stop: async () => {
            clearInterval(rendezvousTimer);
            await db.close();
            await helia.stop(); // stops the embedded libp2p via the mixin
        },
    };
}
