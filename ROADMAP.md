# Roadmap

Phases are ordered by dependency: each one de-risks the next. Bug numbers (#N) and
design concerns (DN) refer to [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## ✅ Phase 0 — Safety net (July 2026)

Goal: make every later change verifiable.

- [x] Merge the dormant `consensus` branch into `main` (fast-forward).
- [x] Test suite (vitest): unit tests for leaf/pollard/sorted-index/identity/consensus,
      integration tests for a single-node database and **two-node replication over
      real libp2p/TCP**, plus `it.fails` pins for known bugs #2, #3, #7.
- [x] GitHub Actions CI: lint + build + test on Node 20/22.
- [x] Prune unused dependencies (faker, inquirer, blockstore-fs, datastore-fs,
      @libp2p/{keychain,mdns,bootstrap,interfaces}, @helia/unixfs).
- [x] Documentation: ARCHITECTURE.md, KNOWN_ISSUES.md, this roadmap, CHANGELOG.md,
      README corrections.

## Phase 1 — Dependency upgrades

Goal: current, supported libraries. Do tooling first, then the libp2p cluster in one
step (its packages must move together), then the rest. Tests green after every step.

| Step | Packages | From → To | Notes |
|---|---|---|---|
| 1.1 | typescript, eslint, typedoc, prettier | 5.4 → 5.9+, 9 → 10, 0.25 → 0.28 | Mechanical; consider TS 7 (native) once stable for this codebase. |
| 1.2 | helia + @helia/*, libp2p + @libp2p/*, @chainsafe/* | helia 4 → 7, libp2p 1 → 3, gossipsub 13 → 14 | Breaking: `connectionEncryption` → `connectionEncrypters`, service typings, logger API. Update README/examples/tests. |
| 1.3 | multiformats | 13 → 14 | CID API is stable; mostly a version bump. |
| 1.4 | jose | 5 → 6 | Breaking: `KeyLike` removed — rework `identity.ts` key typing (use `CryptoKey`). |
| 1.5 | keyv | 4 → 5 | Generics changed; the Keyv usage here is small. |
| 1.6 | misc | p-queue 8 → 9, uint8arrays 5 → 6 | Low risk. |

Exit criteria: `pnpm outdated` clean, CI green, two-node integration test passes.

## Phase 2 — Correctness

Goal: the replication story holds up under adversarial timing. Fix, in order:

1. **#4** topic filtering in `SyncController` (small, unblocks multi-DB nodes).
2. **#1** cache invalidation on merge (small).
3. **#2 + #3** rework `SortedItemsStore`: composite sort key `[timestamp, entryCID]`,
   true timestamp-based LWW per key, removal of superseded records. ⚠️ Changes leaf
   `sort` semantics → wire-format break, land before v2.0.0.
4. **#5** guard `merge()` against empty diffs.
5. **#6** fix `createJWS`, decide the detached-payload (V2) storage question, and
   delete the dead V1/V2 duplicate paths in `utils/helia.ts`.
6. **#7, #8** pollard `compare(undefined)` fallback and real cloning.
7. **#9** deterministic teardown: keep handler references, cancelable repetitive
   tasks, `TimeoutController.clear()`, awaited stops. Add a "close is clean" test
   (vitest will hang-detect leaked timers).
8. Flip the `it.fails` pins to normal tests as each lands.

## Phase 3 — Finish the feature set

- **Delete support (D7):** new `Tombstone` leaf/entry type; `get` honours it,
  iteration skips it, merge propagates it. Decide GC policy for tombstoned blocks.
- **Access control (D1):** implement the manifest `access` controller — start with a
  json-logic rule over `entryCreator` (e.g. creator-only or an allow-list baked into
  the manifest), enforce in `set` **and** `processLeafMerging`/`load`.
- **Honest naming (D2):** rename the consensus controller to write-validation policy,
  or specify actual multi-writer coordination.
- **Ordering (D3):** hybrid logical clocks behind the composite sort key.
- **Identity cache (D6):** LRU keyed by identity CID.
- **Topic = manifest CID (D5).**

## Phase 4 — Production readiness & v2.0.0

- Persist the index/head locally (datastore) so restarts don't need a peer (D4);
  `openDenkmitDatabase` loads the last local head.
- Rename `polllard/` → `pollard/`, fix remaining typos (breaking deep imports — v2).
- Benchmarks (write throughput, sync latency vs. diff size), typedoc regeneration,
  CHANGELOG discipline, npm publish as **2.0.0** (wire format changed in Phase 2).

## Deliberately out of scope for v2

- Browser transports (webrtc/websockets) — the code is transport-agnostic already;
  revisit after v2.
- Multi-database transactions, indexes/queries beyond key lookup and ordered
  iteration.
- Byzantine-fault-tolerant consensus — D2 documents the honest scope.
