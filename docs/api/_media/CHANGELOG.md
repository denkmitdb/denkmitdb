# Changelog

## [4.0.0] — unreleased

To be published as `@denkmitdb/denkmitdb@4.0.0` and `@denkmitdb/mcp@0.3.0`. **Major
version: the entry and manifest formats change** (entries are bound to their
database — see "Security & correctness" below). Databases created by 3.0.0 stay
readable; in a database created by 4.0.0, writes from 3.0.0 nodes are rejected,
so upgrade every writer before using a new database.

### Public API (breaking; no compatibility aliases)

The package exports exactly the public API, by name; tree, sync, storage and
signed-record internals are no longer reachable. Wire formats are unchanged
(test/wire freezes payload bytes and CIDs).

| 3.x | 4.0.0 |
|---|---|
| `createDenkmitDatabase(name, options)` | `createDatabase(name, options)` → `Database<T>` |
| `openDenkmitDatabase(cid, options)` | `openDatabase(address, options)` — address as CID or string |
| `DenkmitDatabaseInterface<T>` | `Database<T>` (no `layers`, `merge`, `load`, `compare`, `heliaController`, …) |
| `DenkmitDatabaseOptions<T>` | `DatabaseOptions<T>` (open) / `CreateDatabaseOptions<T>` (create) |
| `access`, `accessPolicy`, `validationPolicy` options | `consensus: { access, validity }`; `access` is a preset, `{ allowlist }` or `{ policy }` (type `AccessRule`, was `AccessPreset`) |
| `publicWrite: true` | `consensus: { access: "public" }` (MCP: `DENKMIT_PUBLIC_WRITE` refuses to start; use `DENKMIT_ACCESS=public`) |
| `order: 3` | `subtreeLeaves: 8` (leaves per Merkle subtree; the manifest still stores `order`) |
| `keyValueStorage` option | `valueCache` (any `ValueCache`; a Keyv fits) |
| `await db.getManifest()` | `db.manifest`; `manifest.consensus` / `manifest.access` → `manifest.consensus.validity` / `.access`; `manifest.meta` → `metadata`; `manifest.order` → `subtreeLeaves` |
| policy controllers via `db.heliaController` | `db.consensus.access` / `db.consensus.validity` (`SignedPolicy`, frozen) |
| `db.size` / `db.iterator()` / `db.idle()` | `db.recordCount` / `db.entries()` / `db.waitUntilIdle()` |
| `provenance(key)` → `{ cid, creator, … }` | `{ entryCid, writer, timestamp, deleted }` |
| `encryptedRecipients` | `encryptedValueRecipients` |
| MCP `DENKMIT_POLICY_FILE` `{ accessPolicy, validationPolicy }` | `{ access, validity }` (old keys refuse to start) |
| `IdentityInterface` | `Identity` (public: verify, encrypt) / `SigningIdentity` (+ sign, decrypt) |
| `fetchIdentity(cid, new HeliaStorage(helia))` | `fetchIdentity(cid, helia)` |
| `identity.decrypt()` → `false` on failure | → `undefined` |
| `PolicyData` / `PolicyInterface` | `PolicyDefinition` / `SignedPolicy` |
| `DenkmitHeliaInterface` | `HeliaNode` |
| `createEntry`, `createPollard`, `HeliaController`, `SortedItemsStore`, … | internal |

Removed options passed from plain JavaScript (`access`, `accessPolicy`,
`validationPolicy`, `publicWrite`, `order`, `cache`, `keyValueStorage`) throw
instead of being ignored: ignoring one would sign a different, permanent manifest.

### Documentation

- README rewritten around the focus (signed fact exchange between untrusting
  parties): an agent quick start with the daemon, current features, a runnable
  library example (now `examples/example.ts`, type-checked in CI), performance
  table for both machines, and an updated documentation map.
- ARCHITECTURE, KNOWN_ISSUES (status, D8), VISION (sequence), ROADMAP ("Where
  things stand"), the policy cookbook and the launch draft brought up to date:
  entry binding, policies and presets, encrypted values, daemon/seeds/agents,
  and the dropped HTTP head rendezvous.

### Agent identities (delegation, phase 1)

- **`WriteOptions.identity`** on `db.set` / `db.delete`: sign a write with another
  identity (it needs its private key; access and validation policies are
  evaluated for it) without opening the database twice.
- **Daemon:** `DENKMIT_AGENTS=claude-code,codex,…` holds one identity per agent
  (`<device>-<agent>`) and serves each on `denkmitd-<agent>.sock`; the thin client
  selects one with `DENKMIT_AGENT` (implies `DENKMIT_DAEMON=require`). Each agent
  has its own key, namespace, provenance and decryption; `memory_status` reports
  `identity`, `agent` and `device`. The main socket is unchanged.
- Socket choice selects, it does not authenticate (specs/delegation.md §11).

### Private values

- **`encryptValueFor(recipients, value)` / `decryptValue(identity, value)`** —
  a value sealed to one or more recipient identities (General JSON JWE: one
  AES-256-GCM body, one ECDH-ES+A256KW wrapped key per recipient, `kid` = the
  recipient's identity CID). It is an ordinary signed, replicated value; only
  recipients can read it. `isEncryptedValue` / `encryptedRecipients` inspect an
  envelope; `decryptValue` never throws (undefined for non-recipients or tampered
  data). Recipients may be fetched identities (public key only).
- **MCP:** `memory_set` takes `encryptFor` (identity CIDs; `[]` = only me) and
  `includeSelf`; `memory_get` / `memory_list` decrypt for recipients and report
  `encrypted`, `readable` and `recipients` otherwise.
- **Context binding:** `encryptValueFor(…, context)` binds `{database, key,
  writer}` as JWE additional authenticated data, and `decryptValue(…, expected)`
  refuses an envelope read anywhere else — a writer cannot re-post someone else's
  sealed value under its own key and have it read as its own. The MCP server
  always binds and checks the context.
- `Identity.decrypt` reads `kid` from the per-recipient header too, and pins the
  suite to `ECDH-ES+A256KW` / `A256GCM` (a weaker suite in an attacker-built JWE
  is refused). Malformed envelopes are rejected by `isEncryptedValue` and never
  break reads.
- MCP applies `DENKMIT_MAX_VALUE_BYTES` to the encrypted envelope as well.
- Visible to all replicas: key, writer, time, recipients (the writer's claim),
  size. No forward secrecy, rotation or revocation yet. (Reviewed by Codex; the
  findings above were fixed before merge.)

### MCP daemon (`denkmitd`) and policy extensions

- **`denkmitd`, a long-lived P2P node per machine.** It holds the identity, the
  database and a fixed libp2p port (default `4001`), keeps replicating — and
  serving data to peers — while no agent is open, and serves one MCP session per
  local connection on an owner-only Unix socket. `denkmit-mcp` became a thin stdio
  client that pipes to the daemon when its socket answers and otherwise runs the
  embedded node as before (`DENKMIT_DAEMON=auto|require|off`). A systemd user unit
  and an env template ship in `mcp/systemd/`.
- **Networking settings:** `DENKMIT_LISTEN`, `DENKMIT_ANNOUNCE`, `DENKMIT_MDNS=off`
  — enough to run a seed (an always-on peer with no special authority) on a public
  host and join it from anywhere with `DENKMIT_PEERS`. `memory_status` reports the
  node's dialable addresses.
- **`namespace-per-writer` preset:** every identity, the creator included, writes
  and deletes only under `agents/<its-identity-cid>/` — no privileged party.
- **`entryOperation`** (`"put"` | `"delete"`) is a policy input, so delete rules
  are expressible; `createDatabase` accepts custom rules,
  `consensus: { access: { policy }, validity }` (MCP: `DENKMIT_POLICY_FILE`). A
  policy that throws denies.
- `pnpm smoke:daemon` (in CI): daemon + thin clients, restart persistence, and two
  daemons replicating over `DENKMIT_PEERS` with mDNS off.

### Fixed — KNOWN_ISSUES.md #30–#32

- **Value cache keyed by entry CID (#30).** A merge racing an in-flight `get()`
  can no longer leave a stale value cached, and one Keyv can be shared by several
  databases. **Changed:** a caller-supplied Keyv now holds entries under entry-CID
  keys instead of database keys — a persistent cache is cold once after upgrading.
- **Pin before index (#31).** A failed pin leaves an incoming entry unindexed and
  retried on the next sync, instead of live but unpinned; `load()` skips such an
  entry instead of aborting.
- **MCP value size cap (#32).** `DENKMIT_MAX_VALUE_BYTES` (default 64 KiB);
  `memory_get` / `memory_list` return each value's `writer` and `byThisAgent`.

### Demo, launch draft, focus

- **`cd mcp && pnpm demo`** — a narrated six-act run of two real MCP server
  processes: a `prefix-per-writer` database with no server, provenance on a
  shared fact, a refused cross-namespace overwrite, and the memory surviving both
  processes (including a restart with no peers online).
- Refused writes name the key (`may not write key "…"`), which matters once
  presets authorize per key.
- MCP instructions and the `memory_set` description point agents at their own
  namespace.
- README "Why" section, VISION.md "Focus" section (signed fact exchange between
  parties that don't trust each other), and a Show HN draft in
  `docs/launch/show-hn.md` (not posted).

### Access presets & policy hardening

- **Access presets** (`consensus.access` of `createDatabase`): `"creator-only"` (default),
  `"public"`, `"prefix-per-writer"` (the creator writes anywhere; every other
  identity writes and deletes only under `agents/<its-identity-cid>/`), or
  `{ allowlist: [cid, …] }` (validated and normalized at create time).
- **`entryKey`** is a policy input for both the access and the validity rule, and
  policies may use the deterministic `startsWith(value, prefix)` operation.
- **MCP:** `DENKMIT_ACCESS` selects the preset (`allowlist:<cid>,…` too; unknown
  values refuse to start); `memory_status` reports the access policy and the
  agent's own namespace. `@ipld/dag-cbor` is now a declared dependency.
- **Docs:** [docs/policies.md](docs/policies.md) — the policy cookbook. The typedoc
  API reference moved to `docs/api/`; `pnpm docs` previously wiped all of `docs/`,
  including hand-written files.

### Security & correctness — November 2026 review (KNOWN_ISSUES.md #24–#29)

Six defects from an independent Codex + Gemini review, each verified in the code
and pinned by a test in `test/integrity.test.ts` that fails on the old code.

- **Entries are bound to their database (#24, critical).** New entries
  (`ENTRY_VERSION` 2) sign the database address into their payload; new
  databases (`MANIFEST_VERSION` 2) reject entries — including tombstones —
  replayed from another database that shares a writer. Signed entries,
  manifests and heads are shape-checked before use.
- **Deterministic, strictly boolean policies (#25).** Validation policies no
  longer receive the node-local `currentTimestamp` / `currentIdentity`, and only
  a literal `true` authorizes.
- **Bounded, aligned tree comparison (#26).** Fixed `compareNodes` passing the
  parent CID for absent children and computing child positions from pollard
  length instead of fan-out; a shorter peer tree is now aligned by its height.
  Heads with implausible layers/size, misshapen pollards and DAGs that repeat a
  pollard are rejected — previously a 12-layer repeating DAG exhausted the heap.
- **Linear rebuilds (#27).** `iteratorFromIndex` no longer does an O(position)
  lookup per record.
- **`close()` persists acknowledged writes (#28)** — it drains the queue and
  persists a head first.
- **Identity blocks bind their signing key (#29).**

**Compatibility (protocol change — release as 4.0.0).** Databases created by
3.0.0 (v1 manifest) keep accepting their legacy unbound entries, so existing data
stays readable, but only new databases get replay protection. In a new database,
writers still on 3.0.0 produce unbound entries that upgraded replicas reject:
upgrade every writer before relying on a new database. `createEntry` /
`createTombstone` take an optional `manifest` argument (omitting it yields a
legacy v1 entry).

### Dependencies — everything on latest

- **Runtime:** helia 7.1.16, libp2p 3.5.1 (+ matching `@libp2p/*`, `@helia/*`
  patch releases), multiformats 14.0.5, jose 6.2.15, keyv 6, p-queue 10.
- **MCP:** `@modelcontextprotocol/sdk` 1.32, zod 4. Behaviour change:
  `memory_set` now advertises `value` as **required** and rejects a call
  without it at input validation (zod 3 inferred `z.unknown()` as optional).
- **TypeScript 7 (native compiler) builds and typechecks** both packages, run
  side by side with the TS 6 API as Microsoft recommends:
  `"@typescript/native": "npm:typescript@^7"` provides `tsc`,
  `"typescript": "npm:@typescript/typescript6@^6"` keeps typescript-eslint and
  typedoc working (neither supports the TS 7 API yet). tsconfigs set `rootDir`
  and `types: ["node"]` explicitly (TS 7 defaults: `./` and `[]`).
- **Tooling:** vitest 5, ESLint 10 (+ `@eslint/js` 10, eslint-config-prettier
  10, globals 17, eslint-plugin-tsdoc 0.5), `@types/node` 26, tsx, prettier.
  Removed unused `ts-node`, `@eslint/eslintrc` and the `@types/eslint__js` stub.
- **pnpm 12.** Its default supply-chain policies are kept: no package younger
  than the minimum release age (jose is held at 6.2.15 — 6.2.16 was hours old),
  and dependency install scripts run only when allowed (`allowBuilds: esbuild`).

## [3.0.0] — 2026-08-29

First npm publish (`@denkmitdb/denkmitdb@3.0.0`, `@denkmitdb/mcp@0.2.0`). The
helia 7 interface change below is breaking relative to the v2.0.0 git tag, so
the version is bumped honestly even though v2 was never on npm.

### Performance (scripts/bench.mjs is new; numbers in the README)

- **Write throughput ~35× (7 → ~245 ops/s at 10k entries).** Two fixes found by
  the new benchmark: tree rebuilds are **coalesced** (a burst of writes lowers
  the start key of the one queued rebuild instead of enqueueing N rebuilds), and
  interior pollards are stored **unpinned** (pinning each rebuilt pollard walked
  the entire DAG below it on every write — O(database) per write; the signed
  head's recursive pin covers the whole current tree instead).
- **Bulk replication ~16× at 1k entries** (20.3 s → 1.3 s): `load()` fetches
  each level's pollards and verifies entries with bounded concurrency (batches
  of 64) instead of one sequential await per leaf. Still fetch-latency-bound and
  superlinear at depth — batch sync remains on the roadmap.
- Reopen from the persisted head: ~0.55 ms/record at 10k.

### Pre-publish hardening

- **Denied writes no longer persist anything.** `set()`/`delete()` authorize the
  local identity *before* the entry is signed, stored, and pinned — a rejected
  write used to leave a pinned block behind on every attempt.
- **`load()` respects Keyv ownership.** A caller-supplied (possibly shared or
  persistent) Keyv is no longer `clear()`ed when a remote head triggers a full
  reload; only the keys this database indexed are invalidated. Same D4 ownership
  rule `close()` already followed.
- **Reads tolerate missing blocks.** `get()` returns `undefined` (and
  `iterator()` skips the key) when an indexed entry's block is unfetchable,
  instead of throwing and aborting iteration; `provenance()` is now served
  entirely from the verified index (no fetch at all — creator/timestamp/deleted
  were recorded from the signed entry at index time).
- **Additive API: `keys()`** — iterates live keys in write-time order without
  fetching values; tombstoned keys are skipped. Listings and prefix filters
  should prefer it over `iterator()`.
- **denkmit-mcp fails closed on `DENKMIT_PASSPHRASE`.** The server refuses to
  start without a passphrase instead of silently using an insecure development
  default; `memory_list` walks `keys()` (no value fetches for non-matching
  prefixes, values only up to `limit`) and reports `truncated`.
- Regression tests for all of the above (`test/hardening.test.ts`, verified
  failing against the previous behavior); the two long-standing tsdoc lint
  warnings are gone.

### Changed

- **helia 6 → 7 (breaking, pre-publish).** `DenkmitHeliaInterface` is now
  `Helia & { libp2p: DenkmitLibp2pType }` and callers construct the node
  themselves via the helia 7 mixins:
  `withBitswap(withLibp2pLight(createHeliaLight({ codecs: [dagCbor] }), {…libp2p config…}))`
  followed by `await node.start()` (`createHelia` is sync in 7; `helia.stop()`
  stops the embedded libp2p). The library now depends on `@helia/interface`
  rather than `helia`. Rode along: multiformats 14, `@ipld/dag-cbor` 10,
  `@helia/dag-cbor` 6, interface-datastore unpinned at 10 (the 9.0.3 pnpm
  override is gone); mcp moved to blockstore-fs 4 / datastore-fs 12. See
  `examples/example.ts` for the new construction shape.

### Fixed

- **[Critical] The database hung permanently once its tree needed three layers
  (KNOWN_ISSUES.md #22).** `updateLayers` reused one pollard accumulator across all
  upper layers, so a partially-filled pollard was aliased into the layer above and
  appended its own CID into itself; pinning the resulting self-referential block
  never returned, and `db.idle()` never resolved. Triggered by size alone — the 65th
  entry at the default `order: 3`, the 17th at `order: 2`. Affects `v2.0.0`.
- **[High] Pinning ignored the 30 s write deadline (KNOWN_ISSUES.md #23).**
  `HeliaStorage.add()`/`pin()` now pass the abort signal to `pins.add`, so an
  unresolvable link fails instead of blocking forever.
- **Test coverage:** `test/scale.test.ts` exercises multi-layer trees for the first
  time — three- and four-layer builds, cross-layer pollard aliasing, and two-node
  convergence over a three-layer tree.

### Added

- **`mcp/` — denkmit-mcp (prototype).** An MCP stdio server exposing the database
  as shared, signed agent memory: `memory_set/get/delete/list/provenance/status`,
  per-agent identities and data directories, mdns local peer discovery, and an
  end-to-end smoke test (real MCP client over stdio) wired into CI.
- **Additive API:** `DenkmitDatabase.provenance(key)` (entry CID, writer, timestamp,
  tombstone flag); the package entry now re-exports the full public type surface.

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-07-17

The correctness/security release. Everything below happened between v1.0.0 and
v2.0.0 across the phases in [ROADMAP.md](ROADMAP.md); the wire format is v2
(`HEAD_VERSION`/`POLLARD_VERSION` = 2, composite-key ordering) and is **not**
interoperable with v1 (which was never installable). Requires Node 22+.

### Phase 4 — access control, identity cache, persistence, delete, step-1 fixes

- **API freeze (breaking, pre-v2).** `ConsensusController`/`createConsensus`/
  `fetchConsensus`/`ConsensusData` → `PolicyController`/`createPolicy`/`fetchPolicy`/
  `PolicyData` (the thing is a deterministic json-logic policy, not consensus); the
  database wires a validation policy and an access policy — wire-format field names
  (`manifest.consensus`/`manifest.access`) are unchanged. `addSignedV2`/`getSignedV2`
  renamed to `addSigned`/`getSigned` (unused V1 variants and `signWithoutPayload`
  deleted). `src/functions/polllard/` → `pollard/`. Pollard `all()`/`layers`/
  `getLayers()` return snapshots. `order` is honoured on create (validated [1, 8]);
  `sortedItemsStore` and policy injection removed from `DenkmitDatabaseOptions`.

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
