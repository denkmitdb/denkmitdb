# Roadmap

Phases are ordered by dependency: each one de-risks the next. Bug numbers (#N) and
design concerns (DN) refer to [KNOWN_ISSUES.md](KNOWN_ISSUES.md). This plan was
revised in July 2026 after an independent adversarial review (`CODEX_REVIEW.md`):
correctness now comes **before** the runtime-major upgrades, because a green
upgrade on top of a happy-path test suite would certify API compatibility, not
behavior — and several fixes touch the same surfaces as the upgrades anyway.

## ✅ Phase 0 — Safety net (July 2026)

- [x] Merge the dormant `consensus` branch into `main` (fast-forward).
- [x] Test suite (vitest): unit tests for leaf/pollard/sorted-index/identity/consensus,
      integration tests for a single-node database and two-node replication over
      real libp2p/TCP, plus `it.fails` pins for known bugs.
- [x] GitHub Actions CI: lint + build + test on Node 20/22.
- [x] Prune unused dependencies; documentation (ARCHITECTURE, KNOWN_ISSUES, this
      roadmap, CHANGELOG); README corrections.

## ✅ Phase 0.5 — Make the safety net honest (July 2026)

Findings from the adversarial review that invalidated Phase 0's guarantees:

- [x] **Packaging:** the published ESM was unloadable (extensionless specifiers,
      bare `src/` imports). Moved to NodeNext + explicit `.js`; `types` now points
      at the runtime entry's declarations; 16 phantom `export declare function`
      statements removed (including `addEntry`/`getEntry`, which never existed).
- [x] **Runtime:** `import("helia")` failed outside vitest (native
      `node-datachannel`). Replaced the test-only stub with a repo-wide
      `pnpm.overrides` stub so tests, examples and plain `node` share one module
      graph. Consumer installs remain exposed until the helia upgrade (Phase 3).
- [x] **CI:** added a packed-artifact smoke test (`pnpm test:package`), typecheck
      of tests/configs (immediately caught interface drift: `size`, `sendHead`),
      lint over `test/` and configs, action bumps + minimal permissions.
- [x] **Tests:** removed order dependence, real iteration-order assertions,
      strengthened the LWW pin (timestamp + CID + creator), pinned the order-8
      contract discrepancy, factory-wiring consensus test.
- [x] **Docs:** corrected the false trust-model claims (pollards are unsigned; merge
      does not verify entries), added ten review-found issues to KNOWN_ISSUES.md,
      reordered this roadmap.

## ✅ Phase 1 — Specify, then pin (July 2026)

Decisions that freeze the wire format, plus tests that lock in what "correct"
means, so later phases have a target:

- [x] **Ordering & wire-format spec** — [`specs/ordering.md`](specs/ordering.md):
      composite sort key `[timestamp, entryCID]` as a deterministic total order,
      last-write-wins by that key, wall-clock timestamps with a merge-time
      future-skew bound (HLC deferred, with a compatible upgrade path),
      `POLLARD_VERSION`/`HEAD_VERSION` bump to 2 with old-block/foreign-version
      rejection (no v1 migration — v1 was never a usable package).
- [x] **Adversarial acceptance pins** (all `it.fails` today, verified to fail at
      their final assertion): foreign-manifest head rejected (#11), forged leaf
      key not indexed (#10), newer merged entry wins + cache invalidated (#1/#2),
      older merged entry loses (#2) — in `test/adversarial.test.ts`; `SortedEntry`
      metadata distinguished in equality (#12) in `test/leaf.test.ts`; falsy
      values iterated (#18) in `test/database.test.ts`. Each flips to a normal
      `it` as its Phase 2 fix lands — that flip is the acceptance test.

Two-node live conflict *convergence* is intentionally left as future integration
coverage rather than an `it.fails` pin: without the Phase 2 winner rule its
outcome is timing-dependent, and a flaky pin would falsely "pass". The
deterministic single-node conflict pins above cover the same invariant.

## ✅ Phase 2 — Correctness on the current stack (July 2026)

All acceptance pins flipped to normal tests. Delivered:

1. **Authenticated replicated state (#10, #11):** merge fetches + signature-verifies
   the entry and indexes the *signed* key/timestamp/creator (leaf claims ignored);
   heads are bound to the manifest and format version, pollards version-checked.
   The trust model in ARCHITECTURE.md is now accurate.
2. **Index integrity (#2, #3, #12):** composite key `(timestamp, entryCID)`, true
   last-write-wins with removal of superseded records, full-metadata leaf equality.
3. **Async discipline (#13, #14, #15, #5):** awaited pollard appends, propagated +
   error-handled queue/publish/callback promises, awaited `setupSync`, empty-merge
   guard.
4. **Cache & API correctness (#1, #16, #17, #18):** cache invalidation on merge win,
   `createHead` throws on empty, replacement `load()`, falsy-value handling.
5. **Lifecycle (#9)** and smaller defects (#4 topic filter, #6, #7, #8) — plus
   `HEAD_VERSION`/`POLLARD_VERSION` bumped to 2 per `specs/ordering.md`.

**Carried forward:** #19 (ignored `order`/`sortedItemsStore`/`consensusController`
options — interacts with access-control wiring, moved to Phase 4), the residual
low-severity items in #20/8b, and the future-skew *enforcement* of D3 (the bound is
specified; the default constant-true rule doesn't apply it yet — lands with access
control).

Tooling-only upgrades (TypeScript, eslint, typedoc, prettier) can happen at any
convenient point — they don't change runtime behavior.

## Phase 3 — Runtime upgrades (partially done, July 2026)

### ✅ Done

- **Tooling:** TypeScript 5.4 → 5.9, typescript-eslint 7 → 8, typedoc 0.25 → 0.28,
  prettier 3.3 → 3.9. (Held TypeScript at 5.9 rather than the new native 7.x for
  library-emit stability.)
- **jose 5 → 6:** `KeyLike` → `CryptoKey`; non-extractable-by-default keys made
  extractable; `importJWK` now needs the algorithm (stamped into exported JWKs);
  `encrypt`/`decrypt` re-import the EC key under ECDH-ES (jose 6 pins CryptoKey
  usages to the import algorithm).
- **Independent runtime libs:** uint8arrays 5 → 6, p-queue 8 → 9, keyv 4 → 5
  (`Keyv<T>` — dropped second generic), delay 6 → 7, it-drain patch.

### ✅ helia 4 → 6 / libp2p 1 → 3 / gossipsub → floodsub (July 2026)

Reached **libp2p 3** by dropping gossipsub for floodsub. The sync code only ever
used the generic pubsub surface (subscribe/publish/events — no peer scoring, mesh
tuning, or custom validation), so gossipsub was never load-bearing; the latest
gossipsub (14.1.2) still requires libp2p 2, whereas `@libp2p/floodsub@11` supports
libp2p 3. floodsub floods to every subscribed peer (vs gossipsub's mesh) — fine at
this project's scale (one ~36-byte CID every 30 s), and swappable back to gossipsub
when it ships libp2p-3 support, since the code is pubsub-implementation-agnostic.

Verified: 53 tests pass (incl. two-node TCP replication over floodsub), the example
runs end-to-end, the packed package imports. Changes: `gossipsub()` → `floodsub()`;
`PubSub<GossipsubEvents>` → `FloodSub`; `Message` now from `@libp2p/floodsub`;
`connectionEncryption` → `connectionEncrypters`; `HeliaLibp2p<T>` → `Helia<T>`;
`@helia/dag-cbor` pinned to 5.x (matches `@helia/interface ^6`); multiformats held
at 13 (helia 6 requires it); `interface-datastore` deduped to 9.0.3 via
`pnpm.overrides` (helia 6 uses datastore 9, libp2p 3 pulls 10). Removed the unused
`addBytes`/`getBytes` (dead V2 detached-payload leftovers).

**Bonus:** the `node-datachannel` native build is a non-issue — helia uses
`@ipshipyard/node-datachannel` (prebuilt binaries), no stub or override needed.

### ⛔ helia 7 blocked by an architecture change (not gossipsub)

helia 7 removed `helia.libp2p` — its `Helia` interface exposes only
`blockstore`/`datastore`/`pins`/`routing`, decoupling from libp2p entirely. The
whole codebase reaches pubsub through `helia.libp2p.services.pubsub`, so helia 7
needs a refactor: construct libp2p separately and carry it alongside helia (the
`DenkmitHeliaInterface` abstraction would hold both). helia 6 keeps `helia.libp2p`
and already runs libp2p 3, so it's the right stopping point until that refactor is
worth doing — best paired with the **durable head pointer** in Phase 4, which is
what makes libp2p pubsub optional in the first place (and could let an HTTP-only
helia 7 node sync with no libp2p at all).

### Still open (independent of the cluster)

- Topic = manifest CID (D5) and the listener/teardown remnants (#4/#9) — moved to
  the access-control work.
- keyv ownership semantics (D4) — with the Phase 4 persistence work.
- multiformats 13 → 14 — deferred until helia adopts it.

## Phase 4 — Features & v2.0.0

Strictly in this order (each depends on the previous being real):

1. **Access control (D1):** implement the manifest `access` controller (start with
   creator-only / ACL json-logic over `entryCreator`), enforced in `set` **and** the
   now-authenticated merge/load paths. Rename "consensus" to write-validation
   policy, or specify actual coordination (D2).
2. **Delete (D7):** tombstone leaf/entry type — only safe once writes are
   authenticated (#10) and authorized (D1), otherwise any peer can delete anything.
3. **Persistence (D4):** persist index/head locally; `openDenkmitDatabase` loads the
   last local head; defined Keyv ownership semantics. Identity cache (D6).
4. **Pluggable head discovery (D8):** the sync layer currently *only* learns a head
   from a live peer broadcasting over pubsub, so a node that opens the database with
   no data-holding peer online stays empty (D8). Pubsub carries only a ~36-byte
   notification; all data transfer is bitswap — so head discovery is a *strategy*,
   not the sync engine, and should be **selectable by configuration** rather than
   hardcoded. Ship at least two strategies behind one interface, usable alone or
   together:
   - **pubsub** (current): real-time push; low latency; needs a live libp2p transport
     and connected peers. Best for always-on full nodes.
   - **durable pointer** — a mutable pointer to the current head (**IPNS**,
     `@helia/ipns`, keyed by the manifest/identity) that peers *resolve* instead of
     waiting to be told. Fixes the late-joiner / offline-peer / lone-restart gap, and
     over **HTTP delegated routing** needs no libp2p at all (browser / HTTP-only /
     helia 7 nodes).
   The two compose naturally: resolve the durable pointer on open and periodically
   (robust bootstrap), use pubsub for low-latency updates when available. Config
   picks the set — e.g. `discovery: ['pubsub']`, `['ipns']`, or `['ipns','pubsub']`.
   Design decisions to make deliberately:
   - **Who publishes the pointer, and how conflicts resolve** — each writer publishes
     its own head; readers resolve all and merge (merge is already order-independent),
     so no single-writer bottleneck.
   - **Routing/propagation tradeoff** — IPNS over the DHT/pubsub keeps a libp2p
     dependency; IPNS over HTTP delegated routing drops it at the cost of an extra
     dependency, resolution latency, and trusting a routing endpoint.
   - Fold in D5 (topic/name = manifest CID) here.
   This is also the natural point to revisit **helia 7**: once head discovery is a
   configurable strategy and doesn't *require* `helia.libp2p.services.pubsub`, the
   helia-7 libp2p-decoupling (carry libp2p separately for pubsub nodes, or drop it
   for HTTP-only nodes) becomes worthwhile rather than busywork.
5. **Release:** rename `polllard/` → `pollard/` and remaining typos, benchmarks
   (write throughput, sync latency vs. diff size), typedoc regeneration, publish
   **2.0.0** with the Phase 1 wire-format version gate.

## Deliberately out of scope for v2

- Browser transports (webrtc/websockets) — revisit after v2 on the upgraded stack.
- Multi-database transactions; indexes/queries beyond key lookup and ordered
  iteration.
- Byzantine-fault-tolerant consensus — D2 documents the honest scope: per-node
  write validation, not agreement.
