#!/usr/bin/env node
/**
 * denkmitd — the DenkMitDB memory daemon.
 *
 * One long-lived P2P node per machine (or per owner): it holds the identity, the
 * database and a fixed libp2p listen port, keeps replicating while no agent is
 * open, and serves any always-on role (a "seed") with no special authority — any
 * participant can run one. Local agents reach it through `denkmit-mcp`, which
 * pipes their stdio to this daemon's Unix socket; each connection gets its own MCP
 * session over the shared node, so every agent of this owner signs with the same
 * identity (the owner is the trust boundary, not the agent session).
 *
 * The socket is created with mode 0600 inside a 0700 data directory: only this
 * user can connect, so no token is needed. Nothing but libp2p listens on the
 * network.
 *
 * Run: `DENKMIT_PASSPHRASE=… denkmitd` (see mcp/README.md and mcp/systemd/).
 */
import { chmod, mkdir, unlink } from "node:fs/promises";
import { connect, createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    agentIdentityName,
    agentSocketPath,
    configFromEnv,
    DEFAULT_DAEMON_PORT,
    socketPath,
    startMemoryNode,
} from "./node.js";
import { createMemoryServer, type MemorySession } from "./tools.js";

const log = (message: string) => console.error(`[denkmitd] ${message}`);

/** Whether a live daemon already answers on `path`. */
function isListening(path: string): Promise<boolean> {
    return new Promise((resolve) => {
        const probe = connect(path);
        probe.once("connect", () => {
            probe.destroy();
            resolve(true);
        });
        probe.once("error", () => resolve(false));
    });
}

const config = configFromEnv(process.env, { listen: [`/ip4/0.0.0.0/tcp/${DEFAULT_DAEMON_PORT}`] });
if (!config.passphrase) {
    log("DENKMIT_PASSPHRASE is not set. It encrypts this node's signing key at rest; refusing to start.");
    process.exit(1);
}

const path = socketPath(process.env);
const agentPaths = new Map(config.agents.map((agent) => [agent, agentSocketPath(process.env, agent)]));
await mkdir(dirname(path), { recursive: true, mode: 0o700 });
if (await isListening(path)) {
    log(`another daemon is already serving ${path}; exiting`);
    process.exit(1);
}
// Stale sockets left by a crashed daemon.
for (const p of [path, ...agentPaths.values()]) await unlink(p).catch(() => {});

const node = await startMemoryNode(config);
const { db, identity } = node;
if (node.created) log(`created memory database ${db.address.toString()}`);

const sessions = new Set<Socket>();
/**
 * One socket per identity: the main socket serves the device identity, each
 * agent socket serves that agent's identity. Choosing a socket selects an
 * identity; it is not authentication (any process of this user can connect to
 * any of them — specs/delegation.md §11).
 */
const serve = (session: MemorySession) =>
    createServer((socket) => {
        sessions.add(socket);
        const mcp = createMemoryServer(node, config, session);
    const closeSession = () => {
        sessions.delete(socket);
        void mcp.close().catch(() => {});
    };
        socket.once("close", closeSession);
        socket.on("error", (error) => log(`session error: ${error.message}`));
        mcp.connect(new StdioServerTransport(socket, socket)).catch((error: Error) => {
            log(`could not start an MCP session: ${error.message}`);
            socket.destroy();
        });
    });

const servers = [
    { path, server: serve({ identity: node.identity, name: config.identityName }) },
    ...[...agentPaths].map(([agent, agentPath]) => ({
        path: agentPath,
        server: serve({
            identity: node.agents.get(agent)!,
            name: agentIdentityName(config.identityName, agent),
            agent,
        }),
    })),
];

// Create each socket owner-only from the first instant (umask), then make sure.
const previousUmask = process.umask(0o177);
for (const { path: p, server } of servers) {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(p, () => resolve());
    });
}
process.umask(previousUmask);
for (const { path: p } of servers) await chmod(p, 0o600);

log(
    `ready — db ${db.address.toString()} · identity ${config.identityName} (${identity.cid.toString()}) · ` +
        `${db.recordCount} records`,
);
log(`peers can dial: ${node.helia.libp2p.getMultiaddrs().map(String).join(" ") || "(no addresses)"}`);
log(`local agents connect through ${path}`);
for (const [agent, agentPath] of agentPaths) {
    log(`agent ${agent} (${node.agents.get(agent)!.cid.toString()}) connects through ${agentPath}`);
}

let stopping = false;
const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal}: shutting down`);
    try {
        for (const { server } of servers) server.close();
        for (const socket of sessions) socket.destroy();
        await node.stop(); // persists the head (db.close) before libp2p stops
        for (const { path: p } of servers) await unlink(p).catch(() => {});
    } finally {
        process.exit(0);
    }
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
