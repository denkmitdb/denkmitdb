/**
 * Two-agent sync smoke test: spawns TWO server processes with distinct identities
 * and data directories — agent A creates a public-write database, agent B opens it
 * by address — then proves writes replicate both ways via mdns discovery + libp2p,
 * with provenance attributing each record to its writer. This is the real
 * multi-agent deployment shape (one server process per agent).
 *
 * Run manually: `pnpm build && node dist/smoke-sync.js`
 * (kept out of CI: it depends on mdns multicast, which shared runners may block)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = mkdtempSync(join(tmpdir(), "denkmit-mcp-sync-"));
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "index.js");

function assert(cond: unknown, message: string): asserts cond {
    if (!cond) throw new Error(`SYNC SMOKE FAIL: ${message}`);
}

function firstText(result: unknown): unknown {
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
    const block = content?.find((c) => c.type === "text");
    assert(block?.text, "tool returned no text content");
    return JSON.parse(block.text);
}

function makeClient(identity: string, extraEnv: Record<string, string>) {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverPath],
        env: {
            ...process.env,
            DENKMIT_DATADIR: dataDir,
            DENKMIT_IDENTITY: identity,
            DENKMIT_PASSPHRASE: `${identity}-secret`,
            ...extraEnv,
        },
        stderr: "pipe",
    });
    const client = new Client({ name: `sync-smoke-${identity}`, version: "0.0.0" });
    return { client, transport };
}

async function waitUntil(what: string, cond: () => Promise<boolean>, timeoutMs = 60_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await cond()) return;
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`SYNC SMOKE FAIL: timed out waiting for ${what}`);
}

const a = makeClient("agent-a", { DENKMIT_PUBLIC_WRITE: "true" });
const b = makeClient("agent-b", {});

try {
    await a.client.connect(a.transport);
    const statusA = firstText(await a.client.callTool({ name: "memory_status", arguments: {} })) as {
        databaseAddress: string;
        identity: { cid: string };
    };
    console.log(`agent-a up, db ${statusA.databaseAddress}`);

    // Agent B opens the same database by address (fresh identity + datadir).
    b.transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverPath],
        env: {
            ...process.env,
            DENKMIT_DATADIR: dataDir,
            DENKMIT_IDENTITY: "agent-b",
            DENKMIT_PASSPHRASE: "agent-b-secret",
            DENKMIT_DB: statusA.databaseAddress,
        },
        stderr: "pipe",
    });
    await b.client.connect(b.transport);
    const statusB = firstText(await b.client.callTool({ name: "memory_status", arguments: {} })) as {
        databaseAddress: string;
        identity: { cid: string };
    };
    assert(statusB.databaseAddress === statusA.databaseAddress, "B opened a different database");
    console.log("agent-b up, same database");

    // mdns should let the two nodes find each other without any explicit dial.
    await waitUntil("peer discovery (rendezvous/mdns)", async () => {
        const s = firstText(await a.client.callTool({ name: "memory_status", arguments: {} })) as {
            connectedPeers: string[];
        };
        return s.connectedPeers.length > 0;
    });
    console.log("peers connected via rendezvous/mdns");

    // A writes; B must see it with A's provenance.
    await a.client.callTool({ name: "memory_set", arguments: { key: "from/a", value: { n: 1 } } });
    await waitUntil("A's write to reach B", async () => {
        const got = firstText(await b.client.callTool({ name: "memory_get", arguments: { key: "from/a" } })) as {
            found: boolean;
        };
        return got.found;
    });
    const provOnB = firstText(
        await b.client.callTool({ name: "memory_provenance", arguments: { key: "from/a" } }),
    ) as { writer: string; byThisAgent: boolean };
    assert(provOnB.writer === statusA.identity.cid, "B should attribute the record to A");
    assert(!provOnB.byThisAgent, "record is not B's own");
    console.log("A -> B replication + provenance OK");

    // B writes (public-write database); A must converge too.
    await b.client.callTool({ name: "memory_set", arguments: { key: "from/b", value: { n: 2 } } });
    await waitUntil("B's write to reach A", async () => {
        const got = firstText(await a.client.callTool({ name: "memory_get", arguments: { key: "from/b" } })) as {
            found: boolean;
        };
        return got.found;
    });
    const provOnA = firstText(
        await a.client.callTool({ name: "memory_provenance", arguments: { key: "from/b" } }),
    ) as { writer: string };
    assert(provOnA.writer === statusB.identity.cid, "A should attribute the record to B");
    console.log("B -> A replication + provenance OK");

    console.log("MCP SYNC SMOKE TEST PASSED");
} finally {
    await a.client.close().catch(() => {});
    await b.client.close().catch(() => {});
    rmSync(dataDir, { recursive: true, force: true });
}
