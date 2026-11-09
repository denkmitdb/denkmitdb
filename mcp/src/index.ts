#!/usr/bin/env node
/**
 * denkmit-mcp — an MCP stdio server exposing DenkMitDB as shared agent memory.
 *
 * Two modes:
 *  - **Daemon** (preferred): when a `denkmitd` daemon is listening on the local
 *    socket, this process is a thin pipe between the MCP client's stdio and the
 *    daemon. The daemon owns the long-lived P2P node, the identity and the
 *    database, so the machine stays a peer (and a seed) when no agent is open, and
 *    every agent on the machine shares one node.
 *  - **Embedded** (fallback): with no daemon, this process boots its own node for
 *    the lifetime of the MCP session — zero setup, as before.
 *
 * `DENKMIT_DAEMON=auto` (default) picks the daemon when present, `off` forces
 * embedded, `require` fails instead of falling back. See mcp/README.md.
 */
import { connect, type Socket } from "node:net";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configFromEnv, socketPath, startMemoryNode } from "./node.js";
import { createMemoryServer } from "./tools.js";

/** Connects to the daemon socket, or resolves undefined when nothing listens there. */
function tryConnect(path: string): Promise<Socket | undefined> {
    return new Promise((resolve) => {
        const socket = connect(path);
        socket.once("connect", () => resolve(socket));
        socket.once("error", () => resolve(undefined));
    });
}

/** Pipes this process's stdio to the daemon until either side closes. */
function relay(socket: Socket, path: string): void {
    console.error(`[denkmit-mcp] using the denkmitd daemon at ${path}`);
    process.stdin.pipe(socket);
    socket.pipe(process.stdout);
    process.stdin.once("end", () => socket.end());
    socket.once("close", () => process.exit(0));
    socket.once("error", (error) => {
        console.error(`[denkmit-mcp] daemon connection failed: ${error.message}`);
        process.exit(1);
    });
}

async function runEmbedded(): Promise<void> {
    const config = configFromEnv(process.env);
    if (!config.passphrase) {
        // Fail closed: the passphrase encrypts this agent's signing key at rest, and
        // every fact this server writes is attributed to that key. A silent default
        // would make the attribution story a fiction.
        console.error(
            "[denkmit-mcp] DENKMIT_PASSPHRASE is not set. It encrypts this agent's signing key at rest; " +
                "refusing to start without one. Set it in the MCP server's env, e.g.\n" +
                '  "env": { "DENKMIT_PASSPHRASE": "<a strong secret>" }\n' +
                "(or run the denkmitd daemon, which holds the key, and connect through it).",
        );
        process.exit(1);
    }

    const node = await startMemoryNode(config);
    const { db, identity } = node;
    if (node.created) {
        console.error(
            `[denkmit-mcp] created memory database ${db.address.toString()} — ` +
                `share this address (DENKMIT_DB) with other agents to give them a replica`,
        );
    }

    const server = createMemoryServer(node, config);
    await server.connect(new StdioServerTransport());
    console.error(
        `[denkmit-mcp] ready (embedded) — db ${db.address.toString()} · identity ${config.identityName} ` +
            `(${identity.cid.toString()}) · ${db.size} records`,
    );

    const shutdown = async () => {
        try {
            await node.stop();
        } finally {
            process.exit(0);
        }
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

const mode = process.env.DENKMIT_DAEMON ?? "auto";
if (!["auto", "off", "require"].includes(mode)) {
    console.error(`[denkmit-mcp] DENKMIT_DAEMON must be auto, off or require (got ${mode})`);
    process.exit(1);
}

const path = socketPath(process.env);
const socket = mode === "off" ? undefined : await tryConnect(path);
if (socket) {
    relay(socket, path);
} else if (mode === "require") {
    console.error(`[denkmit-mcp] no denkmitd daemon is listening on ${path} (DENKMIT_DAEMON=require)`);
    process.exit(1);
} else {
    await runEmbedded();
}
