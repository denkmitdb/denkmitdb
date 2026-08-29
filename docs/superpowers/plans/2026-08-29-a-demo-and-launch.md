# Demo + Launch Implementation Plan (Part A of the post-v3.0.0 phase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reproducible two-agent demo (replication + provenance + node-kill survival) and a launch post, so v3.0.0 converts into visibility.

**Architecture:** The demo is a narrated Node script in `mcp/` that drives two real denkmit-mcp server processes over MCP stdio (same shape as the existing `smoke-sync.ts`, plus a kill-survival act and human-readable output). The launch post is a markdown draft arguing the VISION.md positioning.

**Tech Stack:** `@modelcontextprotocol/sdk` client (already a dependency), Node ≥22, the published `@denkmitdb/mcp` server.

**Spec:** `VISION.md` (sections "The killer demo" and "Positioning vs. CRDTs") — the demo must show: shared fact, cryptographic provenance, no server, survival after one node dies.

## Global Constraints (all four plans in this phase)

- Node ≥22, ESM only, TypeScript 5.9 (`strict`), pnpm workspace (root + `mcp/`).
- Every PR green on: `pnpm lint` (zero warnings), `pnpm typecheck`, `pnpm build`, `pnpm test` (vitest), `pnpm test:package`; `cd mcp && pnpm build && pnpm smoke`.
- Prettier config: 4-space indent, ~110 col. Match existing comment density and the KNOWN_ISSUES.md-ID citation style.
- Commit messages: imperative summary + body explaining why; end with the project's Co-Authored-By/Claude-Session trailer if authored by Claude.
- Published packages are live (`@denkmitdb/denkmitdb@3.0.0`, `@denkmitdb/mcp@0.2.0`): nothing may break the public API without a version bump + CHANGELOG "breaking" note.

---

### Task A1: The narrated two-agent demo script

**Files:**
- Create: `mcp/src/demo.ts`
- Modify: `mcp/package.json` (add `"demo": "node dist/demo.js"` to scripts)

**Interfaces:**
- Consumes: the denkmit-mcp server (`mcp/src/index.js` after build) via `StdioClientTransport`, exactly as `mcp/src/smoke-sync.ts` does.
- Produces: `pnpm demo` — exits 0 after printing the full narrated flow; later tasks (A2) embed its transcript.

- [ ] **Step 1: Write `mcp/src/demo.ts`**

Start from `mcp/src/smoke-sync.ts` (copy it) and transform it: keep `makeClient`, `firstText`, `waitUntil`, the temp `dataDir` and two-process setup verbatim; replace the assert-style output with the narrated acts below, and add Act 4 (kill survival). The complete new/changed parts:

```typescript
/**
 * The launch demo: two agents, no server, shared memory with cryptographic
 * provenance — and the memory survives one agent dying.
 *
 * Run: pnpm build && pnpm demo   (or: node dist/demo.js)
 * Uses two REAL denkmit-mcp server processes over MCP stdio; every claim
 * printed is read back from the servers, not scripted.
 */

function act(n: number, title: string): void {
    console.log(`\n━━━ Act ${n}: ${title} ━━━`);
}

// ... makeClient / firstText / waitUntil / dataDir exactly as in smoke-sync.ts ...

const a = makeClient("alice", { DENKMIT_PUBLIC_WRITE: "true" });

act(1, "Alice starts — a database is born");
await a.client.connect(a.transport);
const statusA = firstText(await a.client.callTool({ name: "memory_status", arguments: {} })) as {
    databaseAddress: string;
    identity: { cid: string };
};
console.log(`  database address: ${statusA.databaseAddress}`);
console.log(`  alice's identity: ${statusA.identity.cid}`);
console.log("  (no server was configured — the address IS the database)");

act(2, "Bob joins by address — replication with provenance");
const b = makeClient("bob", { DENKMIT_DB: statusA.databaseAddress });
await b.client.connect(b.transport);
const statusB = firstText(await b.client.callTool({ name: "memory_status", arguments: {} })) as {
    identity: { cid: string };
};
await waitUntil("peer discovery", async () => {
    const s = firstText(await a.client.callTool({ name: "memory_status", arguments: {} })) as {
        connectedPeers: string[];
    };
    return s.connectedPeers.length > 0;
});
await a.client.callTool({
    name: "memory_set",
    arguments: { key: "task/42/status", value: { state: "done", by: "alice" } },
});
await waitUntil("alice's write to reach bob", async () => {
    const got = firstText(await b.client.callTool({ name: "memory_get", arguments: { key: "task/42/status" } })) as {
        found: boolean;
    };
    return got.found;
});
const prov = firstText(
    await b.client.callTool({ name: "memory_provenance", arguments: { key: "task/42/status" } }),
) as { writer: string; byThisAgent: boolean; writtenAt: string };
console.log(`  bob reads task/42/status — and can PROVE who wrote it:`);
console.log(`    writer:      ${prov.writer}`);
console.log(`    is alice?    ${prov.writer === statusA.identity.cid}`);
console.log(`    by bob self? ${prov.byThisAgent}`);
console.log(`    written at:  ${prov.writtenAt}`);

act(3, "Bob writes back — every fact is signed by its author");
await b.client.callTool({ name: "memory_set", arguments: { key: "task/42/review", value: { ok: true } } });
await waitUntil("bob's write to reach alice", async () => {
    const got = firstText(await a.client.callTool({ name: "memory_get", arguments: { key: "task/42/review" } })) as {
        found: boolean;
    };
    return got.found;
});
const provOnA = firstText(
    await a.client.callTool({ name: "memory_provenance", arguments: { key: "task/42/review" } }),
) as { writer: string };
console.log(`  alice attributes task/42/review to: ${provOnA.writer === statusB.identity.cid ? "bob (verified)" : "UNEXPECTED"}`);

act(4, "Alice dies — bob keeps everything");
await a.client.close(); // the whole alice process exits
const afterKill = firstText(
    await b.client.callTool({ name: "memory_get", arguments: { key: "task/42/status" } }),
) as { found: boolean; value: unknown };
console.log(`  alice's process is gone; bob still reads task/42/status: ${JSON.stringify(afterKill.value)}`);
console.log("\n  No server. No vendor. Signed facts, attributable forever.");
console.log("\nDEMO COMPLETE");
```

Wrap the whole flow in the same `try { … } finally { close clients; rmSync(dataDir) }` shape as smoke-sync.ts (alice's close is already done in Act 4 — guard the finally with `.catch(() => {})` as smoke-sync does).

- [ ] **Step 2: Add the script and build**

In `mcp/package.json` scripts add `"demo": "node dist/demo.js"`. Run: `cd mcp && pnpm build`
Expected: compiles clean.

- [ ] **Step 3: Run the demo — it must exit 0 with all four acts printed**

Run: `cd mcp && pnpm demo`
Expected: Acts 1–4 print; `is alice? true`; `by bob self? false`; Act 4 prints the surviving value; exit 0.

- [ ] **Step 4: Commit**

```bash
git add mcp/src/demo.ts mcp/package.json
git commit -m "demo: narrated two-agent launch demo (replication, provenance, kill survival)"
```

### Task A2: Launch post draft + README "Why" section

**Files:**
- Create: `docs/launch/show-hn.md`
- Modify: `README.md` (insert a "Why DenkMitDB" section directly after the Features section)

**Interfaces:**
- Consumes: the demo transcript from Task A1 (run `pnpm demo` and paste real output), the README perf table, VISION.md positioning.
- Produces: publishable text; no code surface.

- [ ] **Step 1: Write `docs/launch/show-hn.md`**

```markdown
# Show HN: DenkMitDB – shared memory for AI agents with cryptographic provenance, no server

Title options (pick one at submit time):
- Show HN: DenkMitDB – P2P shared memory for AI agents, every fact signed by its author
- Show HN: Verifiable shared memory for AI agents (IPFS/Merkle-sync, MCP server included)

---

Hi HN — I built DenkMitDB because multi-agent setups have a trust hole:
when agents from different owners share memory, nothing answers "who wrote
this fact, and can I prove it?" Centralized memory services (mem0, Zep, …)
answer it by fiat of the server. CRDTs can't answer it at all — ops are
unsigned and replicas are assumed honest.

DenkMitDB is a distributed key-value store on IPFS (Helia) where:

- every record is a signed, content-addressed block (JWS, self-certifying identity);
- replicas converge by exchanging ONE head CID over pubsub and Merkle-diffing,
  so sync cost scales with the difference, not the database;
- conflicting writes resolve deterministically (LWW on a composite key), and
  entries are signature-verified BEFORE indexing — you can accept data from
  strangers;
- `provenance(key)` returns the writer's identity CID, timestamp, and entry
  CID for any record;
- a json-logic policy in the signed manifest decides who may write —
  evaluated identically by every replica, no consensus, no gas (policies are
  total functions: no loops, always terminate).

There's an MCP server so any MCP-capable agent gets this as shared memory:

    claude mcp add denkmit --env DENKMIT_PASSPHRASE='…' -- npx -y @denkmitdb/mcp

Demo (two real server processes over MCP stdio, then one is killed):

    [paste the `pnpm demo` transcript here at submit time]

Honest limits: single-key LWW (no rich CRDT merges — if you need
collaborative text, use Yjs; a value CAN carry an Automerge doc), wall-clock
ordering with a documented fast-clock trade-off, and bulk replication of huge
databases is still fetch-latency-bound (numbers in the README).

Repo: https://github.com/denkmitdb/denkmitdb — MIT, TypeScript, Node 22+.
I'd love scrutiny of the trust model (KNOWN_ISSUES.md documents every hole
found so far and what closed it).
```

- [ ] **Step 2: Add the README "Why" section**

Insert after the `## 📈 Performance` section in `README.md`:

```markdown
## 🤔 Why

Multi-agent systems have a trust hole: when agents from different owners
share memory, nothing answers *"who wrote this fact, and can I prove it?"*
Centralized memory services answer it by fiat of the server; CRDTs cannot
answer it at all (ops are unsigned; replicas are assumed honest).

DenkMitDB's answer is structural: every record is signed by a
self-certifying identity and verified **before** it is indexed, provenance
is a query (`provenance(key)`), write authorization is a deterministic
policy in the signed manifest that every replica enforces identically, and
none of it needs a server. *CRDTs solve concurrent editing among trusted
peers; DenkMitDB solves attributable state among untrusted peers.* See
[VISION.md](VISION.md) for the full positioning.
```

- [ ] **Step 3: Verify docs build nothing breaks**

Run: `pnpm lint && pnpm typecheck`
Expected: clean (markdown-only change; lint doesn't cover md but catches accidental code edits).

- [ ] **Step 4: Commit**

```bash
git add docs/launch/show-hn.md README.md
git commit -m "docs: launch post draft + README Why section"
```

## Self-Review Notes

- Spec coverage: shared fact ✓ (Act 2), provenance ✓ (Acts 2–3), no server ✓ (Act 1 narration), kill survival ✓ (Act 4), positioning ✓ (A2).
- The demo reuses smoke-sync's proven discovery/wait machinery — no new timing assumptions.
- Recording (asciinema/video) is a human step at submit time, deliberately not a task.
