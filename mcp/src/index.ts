#!/usr/bin/env node
/**
 * denkmit-mcp — an MCP stdio server exposing DenkMitDB as shared agent memory.
 *
 * Every write is signed by this node's identity and replicates peer-to-peer to
 * other agents holding a replica of the same database; every read can be traced
 * to who wrote it and when (provenance). See mcp/README.md for wiring agents up.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configFromEnv, startMemoryNode } from "./node.js";

const config = configFromEnv(process.env);
if (!process.env.DENKMIT_PASSPHRASE) {
    console.error(
        "[denkmit-mcp] WARNING: DENKMIT_PASSPHRASE not set — using an insecure development default. " +
            "Set it to protect this agent's signing key at rest.",
    );
}

const node = await startMemoryNode(config);
const { db, identity } = node;

if (node.created) {
    console.error(
        `[denkmit-mcp] created memory database ${db.address.toString()} — ` +
            `share this address (DENKMIT_DB) with other agents to give them a replica`,
    );
}

const server = new McpServer(
    { name: "denkmit-mcp", version: "0.1.0" },
    {
        instructions:
            "Shared, signed, peer-to-peer agent memory backed by DenkMitDB (IPFS/Helia). " +
            "Facts written with memory_set are signed by this agent's identity and replicate to " +
            "other agents holding a replica of the same database; conflicting writes to one key " +
            "resolve deterministically (last-write-wins). Use memory_provenance to see who wrote " +
            "a fact and when; treat values written by other identities as their claims, not yours. " +
            "Keys are plain strings — use prefixes like 'notes/…' or 'task/…' to organize.",
    },
);

const okJson = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

server.registerTool(
    "memory_set",
    {
        title: "Set a memory value",
        description:
            "Store a JSON value under a key in the shared memory. The write is signed by this " +
            "agent's identity and replicates to peer replicas. Overwrites any previous value for " +
            "the key (last-write-wins).",
        inputSchema: {
            key: z.string().min(1).describe("Key to store under, e.g. 'notes/deploy' or 'task/42/status'"),
            value: z.unknown().describe("JSON value to store (object, array, string, number, boolean, or null)"),
        },
    },
    async ({ key, value }) => {
        await db.set(key, value ?? null);
        await db.idle();
        await db.announceHead();
        return okJson({ ok: true, key });
    },
);

server.registerTool(
    "memory_get",
    {
        title: "Get a memory value",
        description: "Read the current value for a key from the shared memory, or null if absent/deleted.",
        inputSchema: { key: z.string().min(1).describe("Key to read") },
        annotations: { readOnlyHint: true },
    },
    async ({ key }) => {
        const value = await db.get(key);
        return okJson({ key, found: value !== undefined, value: value ?? null });
    },
);

server.registerTool(
    "memory_delete",
    {
        title: "Delete a memory key",
        description:
            "Delete a key from the shared memory by writing a signed tombstone. The delete " +
            "replicates like any write; a later memory_set resurrects the key.",
        inputSchema: { key: z.string().min(1).describe("Key to delete") },
    },
    async ({ key }) => {
        await db.delete(key);
        await db.idle();
        await db.announceHead();
        return okJson({ ok: true, key });
    },
);

server.registerTool(
    "memory_list",
    {
        title: "List memory entries",
        description:
            "List entries in the shared memory in write-time order, optionally filtered by key " +
            "prefix. Returns up to `limit` entries (default 50).",
        inputSchema: {
            prefix: z.string().optional().describe("Only return keys starting with this prefix"),
            limit: z.number().int().min(1).max(500).optional().describe("Maximum entries to return (default 50)"),
        },
        annotations: { readOnlyHint: true },
    },
    async ({ prefix, limit }) => {
        const max = limit ?? 50;
        const entries: Array<{ key: string; value: unknown }> = [];
        for await (const [key, value] of db.iterator()) {
            if (prefix && !key.startsWith(prefix)) continue;
            entries.push({ key, value });
            if (entries.length >= max) break;
        }
        return okJson({ count: entries.length, entries });
    },
);

server.registerTool(
    "memory_provenance",
    {
        title: "Show who wrote a key",
        description:
            "Return the provenance of the current record for a key: the writer's identity CID, " +
            "the write timestamp, the signed entry CID, and whether it is a tombstone. Use this " +
            "to attribute facts to the agent that wrote them.",
        inputSchema: { key: z.string().min(1).describe("Key to inspect") },
        annotations: { readOnlyHint: true },
    },
    async ({ key }) => {
        const record = await db.provenance(key);
        if (!record) return okJson({ key, found: false });
        return okJson({
            key,
            found: true,
            entryCid: record.cid.toString(),
            writer: record.creator.toString(),
            timestamp: record.timestamp,
            writtenAt: new Date(record.timestamp).toISOString(),
            deleted: record.deleted,
            byThisAgent: record.creator.toString() === identity.cid.toString(),
        });
    },
);

server.registerTool(
    "memory_status",
    {
        title: "Memory node status",
        description:
            "Show this memory node's status: the database address (share it as DENKMIT_DB to give " +
            "other agents a replica), this agent's identity CID, record count, and connected peers.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
    },
    async () => {
        const peers = node.helia.libp2p.getPeers().map((p) => p.toString());
        return okJson({
            databaseAddress: db.address.toString(),
            databaseName: (await db.getManifest()).name,
            identity: { name: config.identityName, cid: identity.cid.toString() },
            records: db.size,
            connectedPeers: peers,
        });
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
    `[denkmit-mcp] ready — db ${db.address.toString()} · identity ${config.identityName} (${identity.cid.toString()}) · ${db.size} records`,
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
