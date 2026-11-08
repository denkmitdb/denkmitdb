/**
 * The launch demo: two agents that do not trust each other exchange signed facts
 * through shared memory — no server, provable authorship, each party confined to
 * its own namespace — and the memory outlives both processes.
 *
 * Run: `pnpm build && pnpm demo` (or `node dist/demo.js`).
 * It drives two REAL denkmit-mcp server processes over MCP stdio; every value it
 * prints is read back from those servers, not scripted. Like smoke-sync it relies
 * on same-machine rendezvous (and mdns), so run it on one machine.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = mkdtempSync(join(tmpdir(), "denkmit-demo-"));
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "index.js");

type Agent = { name: string; client: Client };
type Status = {
    databaseAddress: string;
    identity: { cid: string };
    access: { policy: string; ownNamespace: string; isDatabaseCreator: boolean };
    records: number;
    connectedPeers: string[];
};
type Provenance = { writer: string; byThisAgent: boolean; writtenAt: string };

function act(n: number, title: string): void {
    console.log(`\n━━━ Act ${n}: ${title} ━━━`);
}

const short = (cid: string) => `${cid.slice(0, 12)}…${cid.slice(-6)}`;

function text(result: unknown): string {
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
    const block = content?.find((c) => c.type === "text");
    if (!block?.text) throw new Error("DEMO FAIL: tool returned no text content");
    return block.text;
}

async function call<T>(agent: Agent, name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await agent.client.callTool({ name, arguments: args });
    if ((result as { isError?: boolean }).isError) throw new Error(`${name} failed: ${text(result)}`);
    return JSON.parse(text(result)) as T;
}

/** Calls a tool that is expected to be refused; returns the refusal message. */
async function refused(agent: Agent, name: string, args: Record<string, unknown>): Promise<string> {
    const result = await agent.client.callTool({ name, arguments: args });
    if (!(result as { isError?: boolean }).isError) throw new Error(`DEMO FAIL: ${name} was accepted`);
    return text(result);
}

async function start(name: string, extraEnv: Record<string, string> = {}): Promise<Agent> {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [serverPath],
        env: {
            ...process.env,
            DENKMIT_DATADIR: dataDir,
            DENKMIT_IDENTITY: name,
            DENKMIT_PASSPHRASE: `${name}-secret`,
            ...extraEnv,
        },
        stderr: "pipe",
    });
    const client = new Client({ name: `demo-${name}`, version: "0.0.0" });
    await client.connect(transport);
    return { name, client };
}

async function waitUntil(what: string, cond: () => Promise<boolean>, timeoutMs = 60_000): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await cond()) return;
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`DEMO FAIL: timed out waiting for ${what}`);
}

const found = async (agent: Agent, key: string) =>
    (await call<{ found: boolean }>(agent, "memory_get", { key })).found;

let alice: Agent | undefined;
let bob: Agent | undefined;

try {
    act(1, "Alice creates a shared memory — no server");
    alice = await start("alice", { DENKMIT_ACCESS: "prefix-per-writer" });
    const a = await call<Status>(alice, "memory_status");
    console.log(`  database address: ${a.databaseAddress}`);
    console.log(`  alice's identity: ${short(a.identity.cid)}`);
    console.log(`  access policy:    ${a.access.policy}`);
    console.log("  (nothing was provisioned: the address IS the database, and its rules are signed into it)");
    await call(alice, "memory_set", { key: "decisions/release", value: { version: "4.0.0", approved: true } });
    console.log("  alice records a decision: decisions/release = { version: 4.0.0, approved: true }");

    act(2, "Bob joins by address — he gets a replica, not an account");
    bob = await start("bob", { DENKMIT_DB: a.databaseAddress });
    const b = await call<Status>(bob, "memory_status");
    console.log(`  bob's identity:   ${short(b.identity.cid)}`);
    console.log(`  bob may write under: ${b.access.ownNamespace.replace(b.identity.cid, short(b.identity.cid))}`);
    await waitUntil("the two agents to find each other", async () => {
        return (await call<Status>(alice!, "memory_status")).connectedPeers.length > 0;
    });
    await waitUntil("alice's decision to reach bob", () => found(bob!, "decisions/release"));
    const decision = await call<Provenance>(bob, "memory_provenance", { key: "decisions/release" });
    console.log(`  bob reads decisions/release — written by ${short(decision.writer)}`);
    console.log(`    that is alice: ${decision.writer === a.identity.cid}`);

    act(3, "Bob publishes a signed finding in his own namespace");
    const findingKey = `${b.access.ownNamespace}findings/cve-check`;
    await call(bob, "memory_set", { key: findingKey, value: { package: "jose", status: "clean" } });
    await waitUntil("bob's finding to reach alice", () => found(alice!, findingKey));
    const finding = await call<Provenance>(alice, "memory_provenance", { key: findingKey });
    console.log("  alice reads bob's finding and can PROVE who signed it:");
    console.log(`    writer:     ${short(finding.writer)}`);
    console.log(`    is bob?     ${finding.writer === b.identity.cid}`);
    console.log(`    by alice?   ${finding.byThisAgent}`);
    console.log(`    written at: ${finding.writtenAt}`);

    act(4, "Bob tries to rewrite alice's decision — refused");
    const refusal = await refused(bob, "memory_set", {
        key: "decisions/release",
        value: { version: "4.0.0", approved: false },
    });
    console.log(`  bob's write is refused: ${refusal.slice(refusal.indexOf("Access denied"))}`);
    const stillThere = await call<{ value: { approved: boolean } }>(alice, "memory_get", { key: "decisions/release" });
    console.log(`  alice's decision is untouched: approved = ${stillThere.value.approved}`);
    console.log("  (every replica runs the same signed rule on every entry it ingests, so a modified");
    console.log("   client cannot sneak the write in through sync either)");

    act(5, "Alice's process exits — bob keeps everything");
    await alice.client.close();
    alice = undefined;
    const kept = await call<{ value: unknown }>(bob, "memory_get", { key: "decisions/release" });
    console.log(`  alice is gone; bob still reads decisions/release: ${JSON.stringify(kept.value)}`);

    act(6, "Bob leaves too — alice restarts alone and still has his finding");
    await bob.client.close();
    bob = undefined;
    alice = await start("alice"); // same identity + data dir: reopens its own database
    const again = await call<Status>(alice, "memory_status");
    const offline = await call<{ value: unknown }>(alice, "memory_get", { key: findingKey });
    console.log(`  peers online: ${again.connectedPeers.length}; records on alice's disk: ${again.records}`);
    console.log(`  bob's finding, read with nobody else running: ${JSON.stringify(offline.value)}`);
    const offlineProv = await call<Provenance>(alice, "memory_provenance", { key: findingKey });
    console.log(`  still attributed to bob: ${offlineProv.writer === b.identity.cid}`);

    console.log("\n  No server. No accounts. Every fact signed by its author; nobody writes outside their lane.");
    console.log("\nDEMO COMPLETE");
} finally {
    await alice?.client.close().catch(() => {});
    await bob?.client.close().catch(() => {});
    rmSync(dataDir, { recursive: true, force: true });
}
