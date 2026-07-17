/**
 * End-to-end smoke test: spawns the built server over stdio with a throwaway data
 * directory, then drives it through the full tool surface with a real MCP client.
 * Exits non-zero on any failure. Run via `pnpm smoke` (after `pnpm build`).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = mkdtempSync(join(tmpdir(), "denkmit-mcp-smoke-"));
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "index.js");

function assert(cond: unknown, message: string): asserts cond {
    if (!cond) throw new Error(`SMOKE FAIL: ${message}`);
}

function firstText(result: unknown): unknown {
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
    const block = content?.find((c) => c.type === "text");
    assert(block?.text, "tool returned no text content");
    return JSON.parse(block.text);
}

const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
        ...process.env,
        DENKMIT_DATADIR: dataDir,
        DENKMIT_IDENTITY: "smoke",
        DENKMIT_PASSPHRASE: "smoke-passphrase",
    },
    stderr: "pipe",
});

const client = new Client({ name: "denkmit-mcp-smoke", version: "0.0.0" });

try {
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    const expected = ["memory_delete", "memory_get", "memory_list", "memory_provenance", "memory_set", "memory_status"];
    assert(JSON.stringify(names) === JSON.stringify(expected), `tool list mismatch: ${names.join(",")}`);

    const status = firstText(await client.callTool({ name: "memory_status", arguments: {} })) as {
        databaseAddress: string;
        identity: { cid: string };
        records: number;
    };
    assert(status.databaseAddress.startsWith("ba"), "status has no database address");
    assert(status.records === 0, "fresh database should be empty");

    firstText(await client.callTool({ name: "memory_set", arguments: { key: "task/1", value: { state: "open" } } }));
    firstText(await client.callTool({ name: "memory_set", arguments: { key: "notes/a", value: "remember me" } }));

    const got = firstText(await client.callTool({ name: "memory_get", arguments: { key: "task/1" } })) as {
        found: boolean;
        value: { state: string };
    };
    assert(got.found && got.value.state === "open", "get did not round-trip");

    const list = firstText(
        await client.callTool({ name: "memory_list", arguments: { prefix: "task/" } }),
    ) as { count: number; entries: Array<{ key: string }> };
    assert(list.count === 1 && list.entries[0].key === "task/1", "prefix list wrong");

    const prov = firstText(
        await client.callTool({ name: "memory_provenance", arguments: { key: "task/1" } }),
    ) as { found: boolean; writer: string; byThisAgent: boolean; deleted: boolean };
    assert(prov.found && prov.byThisAgent && !prov.deleted, "provenance wrong");
    assert(prov.writer === status.identity.cid, "provenance writer should be this identity");

    firstText(await client.callTool({ name: "memory_delete", arguments: { key: "task/1" } }));
    const afterDelete = firstText(await client.callTool({ name: "memory_get", arguments: { key: "task/1" } })) as {
        found: boolean;
    };
    assert(!afterDelete.found, "delete did not hide the key");
    const provDeleted = firstText(
        await client.callTool({ name: "memory_provenance", arguments: { key: "task/1" } }),
    ) as { deleted: boolean };
    assert(provDeleted.deleted, "provenance should show tombstone");

    console.log("MCP SMOKE TEST PASSED");
} finally {
    await client.close().catch(() => {});
    rmSync(dataDir, { recursive: true, force: true });
}
