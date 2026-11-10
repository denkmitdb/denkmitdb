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
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { agentSocketPath, configFromEnv, createMemoryServer, socketPath, startMemoryNode } from "@denkmitdb/node";
import { relay, tryConnect } from "./relay.js";

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
            `(${identity.cid.toString()}) · ${db.recordCount} records`,
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

// DENKMIT_AGENT selects one of the daemon's agent identities. It only exists in
// a daemon, so it implies DENKMIT_DAEMON=require: silently falling back to an
// embedded node would sign as a different identity than the one asked for.
const agent = process.env.DENKMIT_AGENT?.trim() || undefined;
const mode = process.env.DENKMIT_DAEMON ?? (agent ? "require" : "auto");
if (!["auto", "off", "require"].includes(mode)) {
    console.error(`[denkmit-mcp] DENKMIT_DAEMON must be auto, off or require (got ${mode})`);
    process.exit(1);
}

if (agent && mode !== "require") {
    console.error(`[denkmit-mcp] DENKMIT_AGENT=${agent} needs the daemon; DENKMIT_DAEMON must be require`);
    process.exit(1);
}
let path: string;
try {
    path = agent ? agentSocketPath(process.env, agent) : socketPath(process.env);
} catch (error) {
    console.error(`[denkmit-mcp] ${(error as Error).message}`);
    process.exit(1);
}
const socket = mode === "off" ? undefined : await tryConnect(path);
if (socket) {
    // Survives daemon restarts: reconnects and re-initializes the session (relay.ts).
    relay(socket, path, process.stdin, process.stdout, { onEnd: () => process.exit(0) });
} else if (mode === "require") {
    console.error(
        agent
            ? `[denkmit-mcp] no daemon serves agent "${agent}" on ${path} — is it in the daemon's DENKMIT_AGENTS?`
            : `[denkmit-mcp] no denkmitd daemon is listening on ${path} (DENKMIT_DAEMON=require)`,
    );
    process.exit(1);
} else {
    await runEmbedded();
}
