# HTTP Head-Rendezvous Implementation Plan (Part C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Head discovery over plain HTTP — any URL an agent can GET/PUT a head CID to — so databases converge across NATs/clouds without pubsub reachability. The cheap 80% of D8.

**Architecture:** Heads are already signed and fully re-validated on ingest (`syncNewHead`: signature, manifest binding, version, per-entry auth), so the rendezvous is trusted for **availability/freshness only** — a hostile rendezvous can at worst withhold or replay an old-but-valid head. Client: a tiny `HttpHeadRendezvous` (PUT CID bytes / GET CID bytes) wired into `announceHead()` (publish) and the periodic sync task (poll → `syncNewHead`). Reference server: ~40 lines of Node http, in-memory, keyed by URL path.

**Tech Stack:** global `fetch` (Node ≥22), `node:http` for the reference server, vitest.

**Spec:** `KNOWN_ISSUES.md` D8 ("make head discovery a configurable strategy… durable, resolvable head pointer") and `VISION.md` step "HTTP head-rendezvous". Trust boundary: availability, not authenticity.

## Global Constraints

- Node ≥22, ESM, TS strict, pnpm workspace; all gates green (zero-warning lint, typecheck, build, test, test:package, mcp build+smoke).
- Rendezvous failures must never break a database: log-and-continue, exactly like the pubsub error handling (KNOWN_ISSUES.md #14 style).
- Additive API only → part of v3.1.0.

---

### Task C1: `HttpHeadRendezvous` client (unit-tested against an in-process server)

**Files:**
- Create: `src/functions/rendezvous.ts`
- Modify: `src/functions/index.ts` (export)
- Test: `test/rendezvous.test.ts`

**Interfaces:**
- Produces:
  - `export class HttpHeadRendezvous { constructor(url: string, log?: Logger); publishHead(cid: CID): Promise<void>; fetchHead(): Promise<Uint8Array | undefined>; }`
  - `publishHead` PUTs the CID's bytes; never throws (logs). `fetchHead` GETs; returns `undefined` on any failure/404/oversize; never throws.

- [ ] **Step 1: Write the failing test** (`test/rendezvous.test.ts`)

```typescript
import { createServer } from "node:http";
import { CID } from "multiformats/cid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpHeadRendezvous } from "../src/functions";
import { emptyCID } from "../src/functions/utils/helia.js";

describe("HttpHeadRendezvous", () => {
    const store = new Map<string, Buffer>();
    let url: string;
    const server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        if (req.method === "PUT") {
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => {
                store.set(req.url ?? "/", Buffer.concat(chunks));
                res.writeHead(204).end();
            });
            return;
        }
        const body = store.get(req.url ?? "/");
        if (!body) return void res.writeHead(404).end();
        res.writeHead(200).end(body);
    });

    beforeAll(async () => {
        await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
        const addr = server.address() as { port: number };
        url = `http://127.0.0.1:${addr.port}/db/test`;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("round-trips a head CID", async () => {
        const cid = await emptyCID();
        const rdv = new HttpHeadRendezvous(url);
        await rdv.publishHead(cid);
        const bytes = await rdv.fetchHead();
        expect(bytes).toBeDefined();
        expect(CID.decode(bytes!).equals(cid)).toBe(true);
    });

    it("returns undefined when nothing is published", async () => {
        const rdv = new HttpHeadRendezvous(`${url}-empty`);
        expect(await rdv.fetchHead()).toBeUndefined();
    });

    it("never throws on an unreachable rendezvous", async () => {
        const rdv = new HttpHeadRendezvous("http://127.0.0.1:1/nope");
        await expect(rdv.publishHead(await emptyCID())).resolves.toBeUndefined();
        expect(await rdv.fetchHead()).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/rendezvous.test.ts`
Expected: FAIL — `HttpHeadRendezvous` not exported.

- [ ] **Step 3: Implement `src/functions/rendezvous.ts`**

```typescript
import type { Logger } from "@libp2p/interface";
import { logger } from "@libp2p/logger";
import { CID } from "multiformats/cid";

// A head announcement is a bare CID (~36 bytes); anything much larger is not ours.
const MAX_HEAD_BYTES = 256;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Head discovery over plain HTTP: PUT the current head CID's bytes to a URL,
 * GET the latest bytes back. The rendezvous is trusted for availability and
 * freshness ONLY — every fetched head goes through syncNewHead, which
 * re-validates signature, manifest binding, format version, and per-entry
 * authentication/authorization (KNOWN_ISSUES.md D8), so a hostile rendezvous
 * can at worst withhold or replay an older valid head. Failures are logged and
 * swallowed: discovery is best-effort and must never break the database (#14).
 */
export class HttpHeadRendezvous {
    private readonly log: Logger;

    constructor(
        readonly url: string,
        log?: Logger,
    ) {
        this.log = log ?? logger("denkmitdb:rendezvous");
    }

    async publishHead(cid: CID): Promise<void> {
        try {
            const response = await fetch(this.url, {
                method: "PUT",
                body: cid.bytes,
                headers: { "content-type": "application/octet-stream" },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!response.ok) this.log("publish to %s failed: HTTP %d", this.url, response.status);
        } catch (error) {
            this.log("publish to %s failed: %o", this.url, error);
        }
    }

    async fetchHead(): Promise<Uint8Array | undefined> {
        try {
            const response = await fetch(this.url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
            if (!response.ok) return undefined;
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length === 0 || bytes.length > MAX_HEAD_BYTES) return undefined;
            CID.decode(bytes); // must parse as a CID, or it is junk
            return bytes;
        } catch (error) {
            this.log("fetch from %s failed: %o", this.url, error);
            return undefined;
        }
    }
}
```

Add `export { HttpHeadRendezvous } from "./rendezvous.js";` to `src/functions/index.ts`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/rendezvous.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/functions/rendezvous.ts src/functions/index.ts test/rendezvous.test.ts
git commit -m "rendezvous: HTTP head client (availability-only trust, never throws)"
```

### Task C2: Database integration — publish on announce, poll on sync

**Files:**
- Modify: `src/types/denkmitdb.ts` (option), `src/functions/denkmitdb.ts` (`createDenkmitDatabase`, `openDenkmitDatabase`, `DenkmitDatabase` field + `announceHead` + `setupSync`), `src/types/denkmitdb.ts` `DenkmitDatabaseInput` (carry the option through)
- Test: `test/rendezvous.test.ts` (append an integration describe)

**Interfaces:**
- Consumes: `HttpHeadRendezvous` from C1.
- Produces: `DenkmitDatabaseOptions.headRendezvous?: string` — when set: `announceHead()` also PUTs the head CID; `setupSync()` polls once at startup and inside the existing 30 s repetitive task, feeding bytes to `syncNewHead`.

- [ ] **Step 1: Write the failing integration test** (append to `test/rendezvous.test.ts`; reuse the in-process server from the first describe by hoisting it, or start a second one the same way)

```typescript
describe("rendezvous-only convergence (no pubsub announcement)", () => {
    let nodeA: TestNode;
    let nodeB: TestNode;

    beforeAll(async () => {
        nodeA = await createTestNode("rdv-a");
        nodeB = await createTestNode("rdv-b");
        await connectNodes(nodeA, nodeB); // bitswap transport only — nobody announces on pubsub
    }, 60_000);
    afterAll(async () => {
        await nodeA.stop();
        await nodeB.stop();
    });

    it("a reader converges from the rendezvous pointer alone", { timeout: 60_000 }, async () => {
        const rdvUrl = `${url}/only`;
        const writer = await createDenkmitDatabase<{ v: number }>("rdv-db", {
            helia: nodeA.helia,
            identity: nodeA.identity,
            headRendezvous: rdvUrl,
        });
        await writer.set("k", { v: 1 });
        await writer.idle();
        await writer.announceHead(); // publishes to pubsub AND rendezvous; B is not subscribed yet

        // B opens with the rendezvous configured; the startup poll must find the head.
        const reader = await openDenkmitDatabase<{ v: number }>(writer.address, {
            helia: nodeB.helia,
            identity: nodeB.identity,
            headRendezvous: rdvUrl,
        });
        await waitFor(() => reader.size === 1, { message: "reader to converge via rendezvous" });
        expect(await reader.get("k")).toEqual({ v: 1 });

        await reader.close();
        await writer.close();
    });
});
```

(Imports to add: `createTestNode`, `connectNodes`, `waitFor`, `TestNode` from `./helpers`; `createDenkmitDatabase`, `openDenkmitDatabase` from `../src/functions`.) Note the writer/reader use different helia nodes and the reader connects only via TCP/bitswap — pubsub can't deliver because B subscribes after A's only announcement (the pre-#21 gap), so convergence proves the rendezvous path.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/rendezvous.test.ts`
Expected: FAIL — `headRendezvous` option unknown / reader never converges.

- [ ] **Step 3: Implement**

`src/types/denkmitdb.ts`, in `DenkmitDatabaseOptions` (and mirror in `DenkmitDatabaseInput`):

```typescript
    /**
     * Optional HTTP head-rendezvous URL. When set, head announcements are also
     * PUT here and the periodic sync task polls it — so peers that cannot hear
     * each other's pubsub (NAT, different networks, late join) still converge.
     * The rendezvous is trusted for availability only: fetched heads go through
     * the same validation as pubsub announcements (KNOWN_ISSUES.md D8).
     */
    headRendezvous?: string;
```

`src/functions/denkmitdb.ts`: field + constructor wiring:

```typescript
    private readonly rendezvous?: HttpHeadRendezvous;
    // in the constructor:
    this.rendezvous = mdb.headRendezvous ? new HttpHeadRendezvous(mdb.headRendezvous, this.log) : undefined;
```

In `createDenkmitDatabase` and `openDenkmitDatabase`, add `headRendezvous: options.headRendezvous` to the `mdb` object. Extend `announceHead()`:

```typescript
    async announceHead(): Promise<void> {
        const head = (await this.createOnlyNewHead()) ?? this.head;
        if (!head) return;
        await this.syncController.sendHead(head);
        if (this.rendezvous) await this.rendezvous.publishHead(head.cid); // never throws
    }
```

Extend `setupSync()` — after the existing `addRepetitiveTask`, add the poll (startup + periodic):

```typescript
        const pollRendezvous = async (): Promise<void> => {
            if (!this.rendezvous) return;
            const bytes = await this.rendezvous.fetchHead();
            if (bytes) await this.syncNewHead(bytes);
        };
        await pollRendezvous(); // startup: a fresh reader converges without waiting 30 s
        await this.syncController.addRepetitiveTask(pollRendezvous, 30000);
```

(Import `HttpHeadRendezvous` from `./rendezvous.js`.)

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run && npm run typecheck`
Expected: all pass, including the convergence test.

- [ ] **Step 5: Commit**

```bash
git add src/types/denkmitdb.ts src/functions/denkmitdb.ts test/rendezvous.test.ts
git commit -m "rendezvous: headRendezvous option — publish on announce, poll at startup + 30s"
```

### Task C3: Reference server + MCP env + docs

**Files:**
- Create: `scripts/rendezvous-server.mjs`
- Modify: `mcp/src/node.ts` (env + option pass-through), `mcp/README.md` (env row + section), `README.md` (feature bullet), `CHANGELOG.md`, `KNOWN_ISSUES.md` (D8 partial-close note)

**Interfaces:**
- Consumes: `headRendezvous` option from C2.
- Produces: `DENKMIT_RENDEZVOUS` env on the MCP server; `node scripts/rendezvous-server.mjs [port]` reference server.

- [ ] **Step 1: Write `scripts/rendezvous-server.mjs`**

```javascript
#!/usr/bin/env node
/**
 * Reference head-rendezvous server: an in-memory map of URL path → last PUT
 * body. Deliberately trust-free — heads are signed and re-validated by every
 * client on ingest, so this server only provides availability. Any object
 * store with GET/PUT (S3, a gist, a KV worker) works identically.
 *
 * Run: node scripts/rendezvous-server.mjs [port]   (default 8787)
 */
import { createServer } from "node:http";

const MAX_BODY = 256; // a head announcement is a bare CID (~36 bytes)
const store = new Map();
const port = Number(process.argv[2] ?? 8787);

createServer((req, res) => {
    if (req.method === "PUT") {
        const chunks = [];
        let size = 0;
        req.on("data", (c) => {
            size += c.length;
            if (size > MAX_BODY) return void req.destroy();
            chunks.push(c);
        });
        req.on("end", () => {
            store.set(req.url, Buffer.concat(chunks));
            res.writeHead(204).end();
        });
        return;
    }
    if (req.method === "GET") {
        const body = store.get(req.url);
        if (!body) return void res.writeHead(404).end();
        return void res.writeHead(200, { "content-type": "application/octet-stream" }).end(body);
    }
    res.writeHead(405).end();
}).listen(port, () => console.log(`head-rendezvous listening on :${port} (in-memory, trust-free)`));
```

- [ ] **Step 2: MCP wiring** — `mcp/src/node.ts`: add `rendezvous?: string;` to `MemoryNodeConfig`, `rendezvous: env.DENKMIT_RENDEZVOUS || undefined,` in `configFromEnv`, and pass `headRendezvous: config.rendezvous` in BOTH the `openDenkmitDatabase` and `createDenkmitDatabase` calls.

- [ ] **Step 3: Docs** — `mcp/README.md`: env row `| DENKMIT_RENDEZVOUS | — | HTTP head-rendezvous URL (peers converge across NATs; see scripts/rendezvous-server.mjs) |` plus a short "Remote peers without a shared LAN" subsection under peer discovery. `README.md` Features: add a bullet `**Pluggable head discovery**: pubsub (real-time) and/or an HTTP head-rendezvous URL — a trust-free pointer store any GET/PUT endpoint can provide.` `KNOWN_ISSUES.md` D8: append a line that the HTTP rendezvous closes the fresh-reader gap when configured; IPNS remains future work. CHANGELOG entry under `[Unreleased]`.

- [ ] **Step 4: Full gates + manual end-to-end check**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && cd mcp && pnpm build && pnpm smoke`
Then manually: `node scripts/rendezvous-server.mjs 8787 &`, start two mcp servers with `DENKMIT_RENDEZVOUS=http://127.0.0.1:8787/db1` and `DENKMIT_PEERS` pointing A→B's multiaddr but **without** shared mdns/datadir, verify `memory_get` converges; kill the background server.
Expected: all green; manual check converges.

- [ ] **Step 5: Commit**

```bash
git add scripts/rendezvous-server.mjs mcp/src/node.ts mcp/README.md README.md CHANGELOG.md KNOWN_ISSUES.md
git commit -m "rendezvous: reference server, DENKMIT_RENDEZVOUS, docs (D8 partial close)"
```

## Self-Review Notes

- Spec coverage: durable pointer ✓ (C1/C2), configurable strategy ✓ (option, both discovery modes run together), trust analysis honored ✓ (validation unchanged, availability-only comments), fresh-reader gap ✓ (startup poll + D8 note).
- The integration test proves the rendezvous-only path by exploiting the real pre-#21 pubsub gap (B subscribes after A's only announcement) — no mocking.
- `fetchHead` validates CID parse + size before handing bytes to `syncNewHead`, which re-validates everything else.
