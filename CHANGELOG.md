# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Phase 4 — access control, identity cache, persistence, delete, step-1 fixes

- **Delete via logical tombstones (D7).** `db.delete(key)` writes a signed delete
  record in the same composite LWW order as puts; while it wins, the key is hidden
  from `get`/`iterator`, a newer `set` resurrects it, and the record stays in the
  Merkle tree (no GC). Deletes are authorized like writes — an unauthorized
  tombstone is rejected locally and through merge — replicate to peers with root
  convergence, and survive reopen from the persisted head. `size` counts Merkle
  records including tombstones (matches `head.size`).


- **Local head persistence (D4).** The last locally built head CID is persisted in
  the Helia datastore under `/denkmitdb/head/<manifest-cid>` (written only after the
  tree is complete); `openDenkmitDatabase()` restores it through `syncNewHead`, so
  the pointer is re-validated like a remote announcement. Foreign entries and
  identities accepted during merge are pinned (survive GC). `close()` clears only an
  internally-owned Keyv, never a caller-supplied store. A database now reopens its
  own state with no live peer (`test/persistence.test.ts`); durability across
  process restarts follows the datastore/blockstore the caller gives Helia.


- **Identity cache (D6).** `HeliaController` caches resolved identities in a bounded
  LRU (1024) with in-flight coalescing (failures not cached), so a repeated foreign
  writer's identity is fetched+verified once instead of per entry — the merge
  hot-path. Adds an observability `identityFetchCount`. Covered by
  `test/identity-cache.test.ts`.


- **Access control, creator-only by default (D1).** The manifest `access` field now
  holds a deterministic json-logic authorization policy. Default: only the database
  creator may write (`entryCreator == databaseCreator`), enforced on both `set` and
  the authenticated merge/load path. `createDenkmitDatabase(..., { publicWrite: true })`
  opts into a world-writable database; open reads the policy from the signed manifest
  so a peer cannot loosen it locally. World-writable is no longer the default.
  Covered by `test/access.test.ts` (5 cases).
- **D5:** sync topic is now the manifest CID (`/denkmitdb/2/<cid>`), not the name.
- **#21:** heads are re-announced periodically (`announceHead()`), so a peer that
  connects after the last change converges instead of staying empty.
- Added `DenkmitDatabase.idle()` / `SyncController.onIdle()`; dropped name-based
  `syncController` injection from the integration tests.

### Phase 4 planning — reprioritized after an independent review

- Added `PHASE_PRIORITIES.md` (independent adversarial prioritization of the
  remaining work) and reordered ROADMAP.md Phase 4 to: contract + pins (incl. D5 and
  the head-announcement fix) → access control → identity cache → discovery seam +
  persistence → delete → API freeze → hardening → v2.0.0, with network IPNS / helia 7
  moved post-v2.
- **Corrected stale docs/spec:** `specs/ordering.md` §4 — the proposed 60 s
  future-skew rejection is removed from the replicated policy (it read the node-local
  clock and would break convergence); skew is a documented v2 trade-off, defence is
  post-v2 local admission. Fixed the false "30 s re-broadcast" claim (it doesn't
  exist — new issue #21), the "conflict resolution deviates from LWW" note (fixed in
  Phase 2), the Phase-3-partial/D5 status, and a gossipsub reference in the floodsub
  integration test.
- **New issue #21** (head is only announced when the root changes, so late joiners
  can stay empty) and an expanded #19/D3/D5/D6/D8.

### Phase 3 — dependency upgrades (complete to the ecosystem ceiling)

- **Tooling:** TypeScript 5.4 → 5.9, typescript-eslint 7 → 8, typedoc 0.25 → 0.28,
  prettier 3.3 → 3.9.
- **jose 5 → 6:** `KeyLike` → `CryptoKey`; keys generated/imported as extractable;
  algorithm passed explicitly to `importJWK` (stamped into exported JWKs);
  `encrypt`/`decrypt` re-import the EC key under ECDH-ES for key agreement.
- **Runtime libs:** uint8arrays 5 → 6, p-queue 8 → 9, keyv 4 → 5 (`Keyv<T>`),
  delay 6 → 7.
- **helia 4 → 6, libp2p 1 → 3, and gossipsub → floodsub.** The sync code only used
  the generic pubsub surface, so gossipsub (still libp2p-2-only) was swapped for
  `@libp2p/floodsub@11` (libp2p-3 compatible) to reach libp2p 3. floodsub broadcasts
  to every subscribed peer instead of gossipsub's mesh — fine at this scale, and
  swappable back when gossipsub supports libp2p 3. helia stops at 6 because helia 7
  removed `helia.libp2p` (see ROADMAP.md). `gossipsub()` → `floodsub()`;
  `PubSub<GossipsubEvents>` → `FloodSub`; `Message` from `@libp2p/floodsub`;
  `connectionEncryption` → `connectionEncrypters`; `HeliaLibp2p<T>` → `Helia<T>`;
  `@helia/dag-cbor` 3 → 5; multiformats held at 13; `interface-datastore` deduped to
  9.0.3 via `pnpm.overrides`. Removed the unused `addBytes`/`getBytes`.
- **`node-datachannel` is a non-issue.** helia uses `@ipshipyard/node-datachannel`
  (prebuilt binaries), so `import("helia")` and consumer installs work with no stub
  or override — the Phase 0.5 stub is gone.
- **Node 22+ now required** (helia uses `Promise.withResolvers`, added in Node 22).
  `engines.node` set to `>=22`; CI matrix moved from Node 20/22 to 22/24.

### Phase 2 — replication correctness (behavioral; wire format → v2)

Makes the replication path trustworthy. All Phase 1 acceptance pins now pass as
normal tests. **Breaking:** `HEAD_VERSION` and `POLLARD_VERSION` are 2; v2 nodes
reject v1 heads/pollards. There is no v1 data to migrate (v1 was never installable).

- **Authenticated merge (#10, #11):** merging fetches and signature-verifies each
  entry and indexes the *signed* key/timestamp/creator — forged leaf metadata can
  no longer poison the index. Heads are ingested only when bound to this database's
  manifest and format version; pollards are version-checked.
- **Deterministic ordering & conflict resolution (#2, #3, #12):** the sorted index
  is keyed by the composite key `(timestamp, entry CID)` (per `specs/ordering.md`),
  giving a total order; per-key last-write-wins removes superseded records; leaf
  equality compares all metadata. Same entry set ⇒ same Merkle root regardless of
  delivery order or timestamp collisions.
- **Async discipline (#5, #13, #14, #15):** pollard appends are awaited; queue,
  publish and message-callback promises are propagated and error-handled; empty
  merges no longer schedule a bogus rebuild; `setupSync` is awaited by the factories.
- **Cache & API (#1, #16, #17, #18):** the value cache is invalidated when a merged
  entry wins; `createHead()` throws on an empty database; `load()` fully replaces
  local state; falsy values survive `get()`/`iterator()`.
- **Lifecycle & smaller fixes (#4, #6, #7, #8, #9):** topic-filtered pubsub,
  removable listeners, cancelable repetitive timer, cleared timeout controllers,
  awaited `helia.stop()`; `createJWS` honours `includePayload: false`;
  `Pollard.compare(undefined)` and order-8 fixed; pollard construction copies
  instead of aliasing.
- Added `syncNewHead` to `DenkmitDatabaseInterface`; `SortedItemsStore.set` returns
  a last-write-wins `SetResult`; replaced `iteratorFrom(sortField)` with
  `iteratorFromIndex(startIndex)` and removed the unused `findPrevious`.

### Phase 1 — ordering spec & acceptance pins

- **`specs/ordering.md`**: accepted the v2 ordering model — composite sort key
  `[timestamp, entryCID]` (deterministic total order), last-write-wins by that
  key, wall-clock timestamps with a merge-time future-skew bound (HLC deferred),
  and a `POLLARD_VERSION`/`HEAD_VERSION` bump to 2 that rejects old/foreign-version
  blocks. No v1 data migration (v1 was never installable).
- **`test/adversarial.test.ts`**: six new `it.fails` acceptance pins encoding the
  spec and the replication-trust requirements (KNOWN_ISSUES.md #1, #2, #10, #11,
  #12, #18). Each was verified to fail at its intended assertion, and flips to a
  normal test when its Phase 2 fix lands.
- Added `syncNewHead` to `DenkmitDatabaseInterface` (the ingestion entry point the
  pins drive; caught again by the typecheck gate).

### Phase 0.5 — honest safety net (after independent adversarial review)

An independent Codex review (`CODEX_REVIEW.md`) of Phase 0 found the published
package unloadable and several guarantees overstated. Fixed:

- **ESM output now loads**: switched to `NodeNext` module resolution with explicit
  `.js` specifiers and relative (instead of bare `src/…`) imports. The v1.0.0
  package entry point could never be imported (`ERR_MODULE_NOT_FOUND`).
- **Types entry fixed**: `types` now points at `dist/functions/index.d.ts` (the
  runtime entry). Removed 16 phantom `export declare function` statements from
  `src/types/*` — including `addEntry`/`getEntry`, which never existed — and with
  them a `types → functions` circular dependency. Added missing `size` and
  `sendHead` to `DenkmitDatabaseInterface` (caught by the new typecheck).
- **Runtime works outside vitest**: `node-datachannel` (native, unused WebRTC
  transitive dep) is now stubbed repo-wide via `pnpm.overrides` instead of a
  test-only vitest alias, so `import("helia")`, the README quickstart and the
  examples work under plain `node`. Consumers of the published package remain
  exposed until the helia upgrade (see ROADMAP.md Phase 3).
- **CI now proves packagability**: new `pnpm test:package` packs the tarball,
  verifies entry points, imports the packed code and exercises it; new
  `pnpm typecheck` covers tests/configs; lint extended beyond `src/`; actions
  bumped to v5 with minimal token permissions and PR concurrency cancellation.
- **Tests hardened**: `database.test.ts` no longer order-dependent (each case owns
  its database), iteration order asserted as ordered tuples, the LWW pin now checks
  timestamp + CID + creator, the pollard order-8 contract discrepancy is pinned,
  and the factory-installed consensus rule is tested (not a hand-built copy).
- **Docs corrected**: ARCHITECTURE.md no longer claims pollards are signed or that
  merge verifies entries — the trust model now documents the real gap
  (KNOWN_ISSUES.md #10/#11); KNOWN_ISSUES.md gained ten review-found issues;
  ROADMAP.md reordered — correctness before runtime-major upgrades, access control
  before delete.

### Phase 0 — safety net

Phase 0 of [ROADMAP.md](ROADMAP.md): safety net. No runtime behaviour changes.

### Added
- Test suite (vitest): 49 tests across unit suites (leaf, pollard, sorted index,
  identity, consensus) and integration suites (single-node database, two-node
  replication over TCP). Known bugs are pinned with `it.fails` and cross-referenced
  to KNOWN_ISSUES.md.
- GitHub Actions CI: lint, build, and test on Node 20.x and 22.x.
- Documentation: `ARCHITECTURE.md` (data model, Merkle "pollard" tree, sync
  protocol, trust model), `KNOWN_ISSUES.md` (9 verified bugs + design concerns),
  `ROADMAP.md` (Phases 1–4), this changelog.
- `pnpm.neverBuiltDependencies`: skip the native build of `node-datachannel`
  (WebRTC transitive dependency; the transport is never used).

### Changed
- `main` fast-forwarded to include the previously unmerged `consensus` branch
  (v1 consensus controller, leaf/sync fixes).
- README: removed the unimplemented record-deletion claim, fixed broken badge
  links, documented development workflow.

### Removed
- Unused runtime dependencies: `@faker-js/faker`, `inquirer`, `@inquirer/confirm`,
  `@inquirer/input`, `@inquirer/prompts`, `blockstore-fs`, `datastore-fs`,
  `@helia/unixfs`, `@libp2p/bootstrap`, `@libp2p/keychain`, `@libp2p/mdns`,
  `@libp2p/interfaces` (deprecated).

## [1.0.0] — 2024-06-23

Initial release: distributed key-value database on IPFS/Helia with Merkle-tree
(pollard) consistency, JWS-signed entries, json-logic write validation, and
gossipsub-based head announcement. Includes the `consensus` branch work
(v1 consensus controller) that reached `main` in July 2026.
