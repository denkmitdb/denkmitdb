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

## ✅ Phase 3 — Runtime upgrades (July 2026)

Done as far as the ecosystem allows (libp2p 3 / helia 6; helia 7 deferred — see below).

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

Ordering revised July 2026 after an independent prioritization review
(`PHASE_PRIORITIES.md`). The earlier `access → delete → persistence → IPNS`
sequence was wrong in three ways: persistence is more foundational than delete,
D5 and the head-announcement fix should not wait for anything, and D6 is now a
release concern (authenticated merge fetches + verifies an identity per foreign
entry). Full network IPNS / helia 7 is an under-specified architecture project and
does **not** gate v2. Effort S/M/L/XL; risk is protocol risk, not effort.

Sequence (each builds on the previous):

1. **Contract + pins (M, high risk).** Make the v2 security/API semantics
   deterministic before building on them:
   - **D3 amendment (done in `specs/ordering.md`):** the replicated acceptance rule
     uses only manifest + signed-entry data — never node-local `currentTimestamp` /
     `currentIdentity`. Wall-clock skew is a documented v2 trade-off; skew *defence*
     is post-v2 local admission, not policy.
   - **D2 / #19 API decisions:** split the public `ConsensusController` into
     **validation policy** and **access policy** (semantically-false name); honour
     `order` **on create only** (open uses the signed manifest); **never** allow an
     open-time policy override (policy is part of database identity — overriding it
     destroys convergence); remove `sortedItemsStore` injection (protocol-critical
     state, not an adapter); replace `syncController` injection with the discovery
     strategy interface from step 4. (#19 also omits the ignored `syncController` on
     open — fix that note.)
   - First commits (small, ship immediately): **D5** topic = `/denkmitdb/2/<manifest-cid>`
     (both create/open already have the CID); and the **head re-announcement fix**
     (#21 — a peer that joins after the one announcement stays empty because the 30 s
     task only publishes when the root changed).
   - Write the access-control acceptance tests (see `PHASE_PRIORITIES.md`).
2. **Access control — creator-only vertical slice (✅ done), then immutable ACL.**
   Creator-only is now the **default** policy: a deterministic json-logic rule
   (`entryCreator == databaseCreator`) stored in the manifest `access` field and
   enforced in `set` **and** the authenticated merge/load paths; `publicWrite: true`
   opts into world-writable, and open reads the policy from the signed manifest (no
   local override). Covered by `test/access.test.ts`. **Still to do:** immutable
   allow-list ACLs (a rule over a set of creator CIDs baked into the manifest), and
   the D2 rename (`ConsensusController` → validation/access policy) in the API freeze.
3. **D6 identity cache (✅ core done).** Bounded (1024) CID-keyed LRU of resolved
   identities with in-flight promise coalescing; failures not cached; a repeated
   foreign writer resolves once (`test/identity-cache.test.ts`). **Still to do:** a
   global fetch-concurrency limit and a cheap `kid` prefilter (reject a non-member
   *before* fetching its identity) for the unique-CID DoS — follow-ups, not blockers.
4. **Minimal persistence (D4) (✅ done).** The last locally built head CID is
   persisted under `/denkmitdb/head/<manifest-cid>` (written only after the tree is
   complete); open restores it through `syncNewHead`, so the pointer is re-validated
   like a remote announcement; foreign entries/identities accepted in merge are
   pinned so the head survives GC; `close()` no longer clears caller-supplied Keyv.
   Covered by `test/persistence.test.ts` (reopen with no live peer recovers state
   and root). **Deliberately not done here:** a formal head-source/head-sink
   strategy interface — with only two sources (pubsub + local pointer), both wired
   through existing seams (`SyncControllerInterface`, `syncNewHead`), an abstraction
   now would be speculative; extract it when the remote IPNS strategy (post-v2 D8)
   gives it a third implementation. Persisted materialized index also deferred (the
   head is the source of truth).
5. **Delete — logical tombstones, no GC (D7) (✅ done).** Signed put/delete entry
   union on the existing `SortedEntry` leaf; same composite LWW order; a winning
   tombstone hides the key from `get`/`iterator`; a newer put resurrects; the record
   stays in the tree; authorized like any write (rejected locally and through merge
   for non-writers); survives reopen from the persisted head. **Decision:** `size`
   counts Merkle records including tombstones (consistent with `head.size`); a
   visible-keys count can be added later if needed. No GC/compaction in v2.
   Covered by `test/delete.test.ts`.
6. **API freeze / cleanup (#20, D2, #19) (✅ done).** `ConsensusController` →
   `PolicyController` with `createPolicy`/`fetchPolicy` and validation/access policy
   wiring (wire-format field names unchanged); Pollard getters return snapshots;
   unused tree helpers deleted; V1 signed API and `signWithoutPayload` removed (V2
   methods take the plain names); `polllard/` → `pollard/`; `order` honoured on
   create only; `sortedItemsStore` and policy injection removed from options.
7. **Release hardening (M, medium).** The 53 tests don't cover the product
   invariants: two-node concurrent same-key convergence (deferred in Phase 1, now
   well-defined), unauthorized remote/local writes, restart recovery, late-joiner,
   tombstone replication/restart, plus the package smoke test and benchmarks.
8. **Publish v2.0.0 (S).** With the Phase 1 wire-format version gate.

### Post-v2 — the agent-memory wedge

The strategic frame is [VISION.md](VISION.md): **`denkmit-mcp` is the product;
DenkMitDB is its engine.** The differentiator is trust (signed entries,
provenance, deterministic conflict resolution, no server), not database
features. Sequence, each step shippable on its own:

1. **helia 7 + API-break cleanup (M), before first publish.** The original
   blocker ("helia 7 removed `helia.libp2p`") is smaller than recorded: helia
   7.1's `HeliaInit` takes `blockBrokers`/`routers`/`components`, so libp2p is
   constructed separately and injected. Production coupling is 7 lines in
   `sync.ts` plus the `HeliaStorage.libp2p` passthrough; the real change is
   `DenkmitHeliaInterface` becoming `{ helia, libp2p }` — a **breaking public
   type**, which is why it lands while the package is still unpublished. Budget
   for re-verifying hand-wired bitswap and updating `test/helpers.ts` /
   `mcp/src/node.ts` / `examples/`.
2. **npm publish (S)** — both packages; `npx @denkmitdb/mcp` must work in a
   `claude mcp add` one-liner.
3. **Benchmarks & soak (M):** ≥10k keys, N writers, reopen time; numbers in the
   README. Watch-list from #22's post-mortem: O(n) tree rebuild on
   early-timestamp merges, and reopen replay cost (→ persisted materialized
   index).
4. **Demo + launch post (S):** two machines, no server, provenance on a shared
   fact, node-kill survival.
5. **Policy hardening, then namespace ACLs (M).** First harden the policy
   input surface (VISION.md "third axis"): add `entryKey` (+ value byte-size)
   so key-aware rules are expressible, and remove the node-local
   `currentTimestamp`/`currentIdentity` fields from the *replicated* policy
   input — a custom policy referencing them makes replicas silently diverge
   (the D3 hazard, now user-reachable). Then per-identity key-prefix ownership
   (`agents/<identity-cid>/…`) lands as a **preset policy**, shipped with a
   policy cookbook (creator-only, public, identity allowlist — expressible
   today — prefix-per-writer, key-schema). Delegation entries later.
6. **HTTP head-rendezvous (M) — the cheap 80% of D8.** A URL agents GET/PUT the
   signed head CID to; heads are validated on ingest, so the rendezvous is
   trusted for availability/freshness only (the trust analysis already written
   for delegated routing). Sidesteps IPNS entirely for now and delivers
   pluggable head discovery (loosening the pubsub/libp2p coupling). Full
   IPNS/delegated routing stays a separate, later project with the caveats in
   `PHASE_PRIORITIES.md` (one keypair = one publisher; ES384 vs Ed25519;
   republish ownership; `@helia/ipns` cluster).
7. **Encrypted values (S/M):** per-value JWE to a recipient identity using the
   existing, tested, unused `Identity.encrypt`/`decrypt` — replicate facts peers
   cannot read.

Still-relevant engine work, slotted where it pays for the wedge: **persisted
materialized index** (reopen time — with 3), **tombstone GC/compaction**
(long-lived memory — after 3's numbers say when), **HLC + local skew admission**
(D3 — when multi-writer usage is real, i.e. after 5).

Deliberately not built, per VISION.md: semantic/vector search (the agent does
retrieval; DenkMitDB does trust and sync), and anything that grows the
general-purpose-database identity.

## Deliberately out of scope for v2

- Browser transports (webrtc/websockets) — revisit after v2 on the upgraded stack.
- Multi-database transactions; indexes/queries beyond key lookup and ordered
  iteration.
- Byzantine-fault-tolerant consensus — D2 documents the honest scope: per-node
  write validation, not agreement.
