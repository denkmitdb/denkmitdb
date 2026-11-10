# Known Issues

Status as of November 2026 (4.0.0: the review fixes #24–#32 and #35–#36 and the deployment fixes #33–#34 included).
New problems are tracked as [GitHub issues](https://github.com/denkmitdb/denkmitdb/issues); verified defects
also get an entry here, with the cause, the fix and the regression test. Each item is tagged:

- **✅ Fixed** — resolved and covered by a test (formerly an `it.fails` pin where noted).
- **◻️ Open** — still present; scheduled in [ROADMAP.md](ROADMAP.md).

Severity: **Critical** breaks the trust model or the published package; **High**
can corrupt replicated state or defeat convergence; **Medium** is a real defect
with narrower impact; **Low** is misleading or brittle but off the hot path.

## Replication trust

### 10. ✅ [Critical] Merged index metadata is now authenticated
`processLeafMerging()` fetches and signature-verifies the entry block and indexes
the **signed** key/timestamp/creator, ignoring the (unsigned, forgeable) leaf
claims. A leaf that links a real entry but lies about its key/creator no longer
poisons the index. Covered by `test/adversarial.test.ts` ("does not index an entry
under a key the signed entry does not carry"). Pollards remain unsigned by design;
their integrity now comes from re-deriving the tree from authenticated entries.

### 11. ✅ [High] Foreign / wrong-version heads are rejected
`syncNewHead()` ingests a head only when `head.manifest` equals this database's
manifest CID **and** `head.version === HEAD_VERSION`; `getPollard()` likewise
rejects pollards whose version differs. Covered by `test/adversarial.test.ts`
("rejects a head bound to a foreign manifest").

### 12. ✅ [High] `SortedEntry` leaf equality compares all metadata
`isLeavesEqual()` now compares `link`, `creator`, `key` and `sort` for
`SortedEntry` leaves, so tree comparison surfaces (rather than hides) differing or
forged metadata. Covered by `test/leaf.test.ts`.

### 13. ✅ [High] Pollard appends are awaited
`updateLayers()` awaits every `pollard.append(...)`, so per-leaf hashing can no
longer race the final `updateLayers()` pass.

### 14. ✅ [High] Queue, publish and message-callback promises are propagated
`SyncController.addTask` awaits the queued task and catches/logs failures;
`sendHead` awaits `pubsub.publish`; `newMessage` attaches a `.catch`. Background
failures surface on the logger instead of becoming unhandled rejections.

## Correctness (Phase 0 findings)

### 1. ✅ [High] Cache is invalidated when a merged entry wins
`processLeafMerging()` deletes the cached value for a key when an incoming entry
wins the last-write-wins comparison, so a subsequent `get()` refetches the winner.
Covered by `test/adversarial.test.ts` ("a newer merged entry wins and invalidates
the cached value").

### 2. ✅ [High] True last-write-wins, superseded records removed
`SortedItemsStore.set()` keeps the record with the greatest composite key
`(timestamp, entryCID)` for each key and erases the superseded record from the
ordered index, so exactly one live record per key remains and merge order no
longer changes the outcome. Covered by `test/sortedItems.test.ts` and the
adversarial suite.

### 3. ✅ [High] Same-millisecond writes no longer collide
The ordered index is keyed by the composite key, so two keys written in the same
millisecond stay distinct (tie-broken by entry CID). Covered by
`test/sortedItems.test.ts`.

### 4. ✅ [High] Pubsub messages are filtered by topic
`newMessage()` early-returns unless `message.detail.topic === this.name`, and the
callback is `.catch`-guarded. (Databases that share a *name* still share a topic —
see D5, which the manifest-binding check in #11 now backstops.)

### 5. ✅ [Medium] `merge()` guards against empty diffs
`merge()` only schedules a rebuild when at least one leaf was applied, so a
local-only difference no longer dereferences an end iterator.

### 6. ✅ [Medium] `createJWS` honours `includePayload: false`
`includePayload = includePayload ?? true` (was `|| true`). The detached-payload
storage path (V2) remains commented out pending the Phase 3 jose decision; the
V1/V2 duplication is still to be consolidated then.

### 7. ✅ [Medium] `Pollard.compare(undefined)` falls back to empty
The empty-pollard fallback now runs before the order check. Covered by
`test/pollard.test.ts`.

### 8. ✅ [Medium] Pollard construction copies instead of aliasing
The constructor deep-copies incoming layers and `addLeaf` copies the leaf, so
callers can't mutate internal state through a shared reference. (The public
`layers`/`all()` getters still expose internal arrays — see #20.)

### 9. ✅ [Medium] Deterministic teardown
`SyncController` keeps bound handler references and removes both the `message` and
`subscription-change` listeners on close, cancels the repetitive-task timer
(`clearDelay`) behind a `closed` flag, and awaits the queue draining.
`HeliaStorage` clears every `TimeoutController` in a `finally` and awaits
`helia.stop()`.

### 18. ✅ [Medium] Falsy values survive
`get()` distinguishes a cache miss from a cached falsy value (`!== undefined`), and
`iterator()` yields falsy values instead of dropping them. Covered by
`test/database.test.ts`.

### 16. ✅ [Medium] `createHead()` on an empty database throws
Instead of returning an `undefined` behind a non-null assertion, `createHead()`
throws a clear "database is empty" error.

### 17. ✅ [Medium] `load()` is a full replacement
`load()` clears the layers, the sorted index, the value cache and the cached head
before ingesting the remote tree, so it no longer unions old records into the
loaded state.

## Still open

### 8b/20. ✅ Getter snapshots; dead helpers removed
`Pollard.all()`, the `layers` getter and `getLayers()` return snapshots instead of
live internal arrays. The unused tree-navigation helpers
(`getPollardTreeNodeLeft/Children/Parent`, which also carried wrong position
arithmetic) are deleted.

### 19. ✅ Public options resolved (honour, remove, or manifest-bind)
`order` is now honoured **on create only** (validated integer in [1, 8]; open always
uses the signed manifest value). The convergence-hazardous injection points are
**removed** from `DenkmitDatabaseOptions`: `sortedItemsStore` (protocol-critical
state) and the open-time policy override (policy is part of database identity; the
access/validation policies are always constructed on create and fetched from the
signed manifest on open). `syncController` remains injectable and is honoured by
both create and open.

### 21. ✅ [High] No head re-announcement — late joiners could stay empty
The 30 s sync task and public `sendHead()` both called `createOnlyNewHead()`, which
returns `undefined` when the root has not changed — so a node only ever published a
head when a write **changed the root**, with no periodic re-broadcast. A peer that
connected *after* the one announcement could stay empty until some later write.
**Fixed:** added `announceHead()`, which re-announces the current head
unconditionally, and pointed the 30 s periodic task at it. Covered by two
late-joiner integration tests (`test/sync.integration.test.ts`) — one pins the old
change-gated behavior, one proves re-announcement converges. The durable-pointer
half (a reader with *no* live data-holding peer at all) remains D8.

### 22. ✅ [Critical] Multi-layer tree rebuild aliased one layer's pollard into the next
`updateLayers` created the upper-layer accumulator **once**, before the loop over
layers, instead of once per layer. When a layer ended with a partially-filled
pollard, `handlePollardCreation` saw `isFree() === true` and did not replace it, so
the next layer up kept appending into the *same object already stored at*
`layers[layerIndex - 1][last]` — including that pollard's own CID. The resulting
self-referential block made recursive pinning walk a cycle and never return, so
`db.idle()` never resolved and every later write and merge queued behind it forever.

Triggered by database size alone, at the first count needing a third layer:
**65 entries at the default `order: 3`** (17 at `order: 2`). Present in `v2.0.0`.
**Fixed:** the accumulator is created fresh at the top of each layer iteration.
Covered by `test/scale.test.ts` — three- and four-layer trees, an assertion that no
pollard instance appears in two layers, and two-node convergence over a three-layer
tree (the first test in the suite to exercise `compareNodes` recursion through
intermediate layers at all).

### 23. ✅ [High] Pinning ignored the write deadline
`HeliaStorage.add()` passed its 30 s `TimeoutController` signal to
`heliaDagCbor.add` but not to `drain(this.helia.pins.add(cid))`; `pin()` had no
deadline at all. Recursive pinning walks the DAG and blocks on any link it cannot
resolve locally, so an unresolvable link waited forever instead of failing. This is
what turned #22 into a silent hang rather than a timeout, and it is reachable on its
own whenever a pinned tree references a block that is not held locally.
**Fixed:** both paths pass the abort signal.

## Review 2026-11 (Codex + Gemini, verified against the code)

All six are pinned by `test/integrity.test.ts`; each test was confirmed to fail on
the pre-fix code.

### 24. ✅ [Critical] Signed entries were not bound to their database
An entry's signed payload was `{version, timestamp, key, value|deleted}` — nothing
named the database. Ingestion checked the head's manifest, the signature and the
writer's authorization, but any entry or **tombstone** written to database X by a
writer also authorized in database Y could be wrapped in a head for Y and accepted
there. **Fixed:** `ENTRY_VERSION` 2 entries carry `manifest` (the database
address) inside the signed payload, and `MANIFEST_VERSION` 2 databases accept only
entries bound to their own address. Legacy v1-manifest databases (created by
3.0.0) still accept legacy unbound entries, so existing data stays readable — but
they keep the replay exposure; create a new database to get the binding.
`fetchEntry` and `fetchManifest` now check the shape of the signed payload
(version, integer timestamp, string key, exactly one of put/tombstone; manifest
order and policy CIDs) — a valid signature only proves who wrote the bytes.

### 25. ✅ [High] Policies saw node-local inputs and truthy results authorized
The validation policy received `currentTimestamp: Date.now()` and the receiving
node's `currentIdentity`, so a custom policy reading them accepted an entry on one
replica and rejected it on another — the exact divergence `specs/ordering.md` §4
forbids. `execute()` also returned json-logic's raw result, so `"false"`, `[]` or
any object authorized. **Fixed:** the validation input is
`{databaseCreator, entryTimestamp, entryCreator}` on both the write and the merge
path, and only a literal `true` authorizes. Built-in policies are unaffected.

### 26. ✅ [High] Tree comparison: wrong child CIDs, misaligned layers, unbounded walk
`compareNodes` passed the *parent's* CID down for an empty or hash child,
re-fetching the parent as if it were its own child, and used the pollard's current
length instead of the fan-out to compute child positions, so right-edge subtrees of
three-plus-layer trees were compared against the wrong local nodes. A shorter remote
tree was never aligned to its own height either (it converged only because the
parent-CID reuse happened to land on the remote root). Worse, nothing bounded the
walk: `head.layers` was trusted, pollard `order`/`length` were trusted as loop
bounds, and content addressing lets a hostile DAG link one child many times, which
both `compare` and `load` walked exponentially — a 12-layer head crashed the test
worker with an out-of-memory abort. **Fixed:** the remote tree is aligned by its
height (virtual leftmost path above its root), child positions use the fan-out,
heads must claim an integer layer count within what 2^40 entries need and a size
those layers can hold, remote pollards must match this database's order and width,
and a per-head budget rejects repeated pollards and more pollards than the claimed
size allows. `load` walks and validates the whole remote tree before touching local
state.

### 27. ✅ [Medium] Positional iteration made every rebuild O(n²)
`SortedItemsStore.iteratorFromIndex` called js-sdsl `getElementByPos` once per
record; that call is an in-order walk from the root (O(pos)). **Fixed:** one
positional lookup, then a forward tree iterator, snapshotted synchronously so a
concurrent `set()` that erases a superseded node cannot invalidate it.

### 28. ✅ [High] `close()` dropped writes made shortly before it
`close()` cleared the pending tree rebuild without building a head, so the
persisted head pointer (D4) lagged behind acknowledged writes until the periodic
30 s announcement. **Fixed:** `close()` drains the queue and persists a head before
shutting sync down (it does not announce). A crash between a write and the next
head is still a loss window: durability points are `createHead()`, the periodic
announcement, and `close()`.

### 29. ✅ [Medium] Identity blocks did not bind their signing key
`fetchIdentity` verified the identity block with the JWK embedded in its header,
while every later signature check uses the public key stated in the payload; the
two were never compared. Not a signature forgery (a JWS's `kid` is signed), but an
identity block was not self-certifying for the key it advertises. **Fixed:** the
embedded and stated keys must have the same RFC 7638 thumbprint and the header
algorithm must equal the stated one.

### 30. ✅ [Medium] `get()` could cache a value that lost a concurrent merge
`get()` fetched the indexed entry, and a winning merge or delete that landed while the
fetch was in flight invalidated the cache *before* `get()` wrote the old value into
it — that stale value was then served until the key changed again. A caller-supplied
Keyv shared by two databases also mixed their values (both cached by database key).
**Fixed:** the cache is keyed by **entry CID**. An entry's value never changes, so no
interleaving of reads, writes and merges can make a cached value stale, and a shared
Keyv cannot mix databases. A superseded record's value is deleted when a newer record
wins. `get()` now reads the winner from the key map without computing a tree position.
Callers who supplied a persistent Keyv see one cold read per key after upgrading.

### 31. ✅ [Medium] A pin failure after indexing left a half-applied entry
`processLeafMerging` indexed an incoming entry and then pinned it; when the pin threw,
cache invalidation and the tree rebuild were skipped, and every later sync saw the
entry as already applied — it stayed live but unpinned (lost on GC/restart), and a
pin failure during `load()` aborted the whole load after local state was cleared.
**Fixed:** an incoming entry that would win is pinned **before** it is indexed; a
failed pin leaves nothing behind and is logged, and the next announcement of the head
retries it. `load()` skips such an entry instead of aborting.

### 32. ✅ [Low] MCP `memory_set` had no value size limit
Any MCP client could store arbitrarily large values, and every value is signed,
pinned and replicated to every peer. **Fixed:** `DENKMIT_MAX_VALUE_BYTES` (default
64 KiB of UTF-8 JSON; malformed values refuse to start) caps `memory_set`, and an
oversized write is refused before anything is stored. `memory_get` and `memory_list`
now return each value's `writer` and `byThisAgent`, and the tool descriptions tell
agents to treat other identities' values as untrusted input, not instructions.
**Still open:** the cap is the MCP server's, not the library's — a peer running its
own client can still replicate larger entries into a database (bounded only by
block-size limits), and policies cannot see value size yet (VISION.md, policy
inputs). Signed text from another agent remains potential prompt-injection content;
attribution makes it visible, not safe.

### 33. ✅ [High] The daemon dialed `DENKMIT_PEERS` only once ([issue #26](https://github.com/denkmitdb/denkmitdb/issues/26))
A connection to a configured peer that was lost later — a laptop that slept, a
changed network, a restarted seed — was never restored, and a peer that was down
when the daemon started was never reached. A replica could silently fall behind: the
MacBook node sat at 15 of 19 records with no connection although the seed was
reachable. **Fixed (#22):** the daemon redials every configured peer without a
connection every `DENKMIT_REDIAL_SECONDS` (default 30) and within ~2 s of a
disconnect, logging only state changes. `smoke:daemon` restarts the seed (which does
not know the peer) and requires the peer to reconnect by itself; the check fails on
the old code.

### 34. ✅ [Medium] Agents lost their memory tools whenever the daemon restarted ([issue #27](https://github.com/denkmitdb/denkmitdb/issues/27))
The thin client (`denkmit-mcp`) piped stdio to the daemon socket and exited when the
socket closed, so every daemon restart or update took the memory tools away from
every running agent until `/mcp` or a restart — found by the first integration test
between Claude Code sessions on different machines. **Fixed (#25):** `mcp/src/relay.ts`
reconnects and replays the session's `initialize` / `notifications/initialized` to the
new daemon session itself; requests in flight at the drop get a JSON-RPC error to
retry, and requests sent while the daemon is away wait up to 15 s. `smoke:daemon`
keeps a client open across a restart (the old client fails with `Not connected`).

## Review 2026-11, second round ([docs/review-2026-11.md](docs/review-2026-11.md))

### 35. ✅ [Medium] `memory_get` / `memory_list` could label an old value with a newer writer ([issue #40](https://github.com/denkmitdb/denkmitdb/issues/40))
Both tools read the value (`db.get`) and then the provenance (`db.provenance`) in two
separate awaits (`mcp/src/tools.ts`, `memory_get` and `memory_list`). A replacement
indexed in between — a local write or a merged remote entry — makes the tool return the
old value with the new writer and `writtenAt`. **Fixed:** `mcp/src/read.ts`
(`readAttributed`) reads the provenance before and after the value and retries until
both name the same entry — the winning record only moves forward, so the value is that
entry's. `pnpm smoke` replays the race against a source that swaps its record while a
value is in flight.

### 36. ✅ [Low] A write rejected by the validity rule left a signed, pinned block ([issue #41](https://github.com/denkmitdb/denkmitdb/issues/41))
`set` and `delete` check the access rule before signing, but the validity rule only
after `createEntry` / `createTombstone` has signed, stored and pinned the block
(`src/database.ts`). Every `VALIDITY_REJECTED` write leaves an unreferenced block
locally; it is never announced or replicated. **Fixed:** the rule's inputs
(timestamp, writer, key, operation) are all known before signing, so `set` and
`delete` evaluate it first and sign the entry with exactly that timestamp.
`test/hardening.test.ts` asserts an unchanged pin set after rejected writes (fails on
the old code).

## Packaging & tooling

- **✅ [Fixed 4.0.0] `npx -y @denkmitdb/mcp` could not start the server**
  ([issue #28](https://github.com/denkmitdb/denkmitdb/issues/28)) — the package has two
  commands and none is named after it. The docs run the installed `denkmit-mcp`
  (`npx -y --package=@denkmitdb/mcp denkmit-mcp` without a global install); the quick
  start is rehearsed on the packed tarballs.
- **✅ [Fixed 0.5] Broken ESM output** — NodeNext resolution with explicit `.js`
  specifiers; guarded by `scripts/package-smoke.mjs` in CI.
- **✅ [Fixed 0.5] Stale hand-written type declarations** — removed; `types` points
  at the runtime entry's declarations.
- **✅ [Fixed] `node-datachannel` native build.** helia uses
  `@ipshipyard/node-datachannel` (prebuilt binaries), so `import("helia")` and
  consumer installs work with no stub or override. The repo-local stub is removed.
  (One `pnpm.overrides` entry remains: `interface-datastore` pinned to 9.0.3 to
  dedupe helia 6's datastore 9 against libp2p 3's datastore 10.)

## Design concerns

### D1. ✅ Access control — creator-only by default
The manifest `access` field now holds a real, deterministic json-logic authorization
policy: by default **creator-only** (only the identity that created the database may
write, `entryCreator == databaseCreator`), enforced on both the local `set` path and
the authenticated merge/load path. `createDenkmitDatabase(..., { publicWrite: true })`
opts into a world-writable database; the policy is read from the signed manifest on
open, so a peer cannot loosen it locally (KNOWN_ISSUES #19). Covered by
`test/access.test.ts` (creator writes, non-creator local write and merged entry both
rejected, public opt-in, no local override). Remaining for later: dynamic/allow-list
ACLs (post-v2), and a cheap `kid` prefilter before identity fetch (D6). The
world-writable *default* is gone — it's now an explicit opt-in.

### D2. ✅ "Consensus" names the consensus rules — nothing more
In 4.0.0, `consensus` means what it means for a blockchain's consensus rules: the
rules every replica enforces identically, `consensus.access` (who may write) and
`consensus.validity` (which authorized entries are valid), both deterministic
policies in DenkMit Logic 1, signed into the manifest. It does not mean a voting
protocol: nodes never agree collectively and there is no finality — replicas
converge by deterministic last-write-wins (ROADMAP: "out of scope: BFT consensus").
Wire field names are unchanged: the manifest keeps `access` and `consensus` (the
validity rule); manifest v3 can give the wire the same `{ access, validity }` shape.

### D3. ◻️ Wall-clock ordering (fast-clock trade-off, accepted for v2)
Ordering uses wall-clock timestamps with the entry-CID tie-break (a deterministic
total order — see `specs/ordering.md`). Clock skew still decides *which* write wins
a conflict — a writer with a fast clock wins for the duration of its skew. This is
an accepted, documented v2 trade-off. **Skew enforcement must not go into the
replicated policy:** an earlier draft proposed rejecting entries >60 s ahead of the
*local* clock, but the acceptance decision must be a pure function of manifest +
signed-entry data (not node-local `currentTimestamp`/`currentIdentity`), or replicas
diverge on which entries they accept. Skew *defence* is post-v2 local admission
(durable quarantine with retry), and HLC is deferred with a compatible upgrade path.
See `specs/ordering.md` §4.

### D4. ✅ (minimal slice) Local head persistence + Keyv ownership
The last locally built head CID is persisted in the Helia datastore under
`/denkmitdb/head/<manifest-cid>` (written only after the head/tree is complete), and
`openDenkmitDatabase()` restores from it **through `syncNewHead`** — i.e. the
pointer is re-validated exactly like a remote announcement (signature, manifest
binding, version, per-entry authentication + authorization), so a tampered pointer
degrades to an empty database, never to corrupted state. Foreign entries and
identities accepted during merge are **pinned**, so the referenced blocks survive
Helia GC. `close()` now clears only an internally-owned Keyv, never a
caller-supplied store. Covered by `test/persistence.test.ts` (pointer written;
reopen with no live peer recovers state and root; caller Keyv survives close).
Durability across process restarts follows the stores the caller gives Helia — with
a persistent datastore/blockstore, reopen-from-disk works; with in-memory stores the
pointer lives as long as the node. **Deferred:** persisted materialized index (the
head is the source of truth; rebuild is the startup cost).

### D5. ✅ The pubsub topic is now the manifest CID
Was the manifest *name*, so distinct databases sharing a name shared a topic and
received each other's (rejected-but-fetched) announcements. **Fixed:** the topic is
`syncTopic(manifest.cid)` = `/denkmitdb/2/<manifest-cid>` — versioned and
manifest-scoped. Covered by a topic-derivation assertion plus the existing two-node
sync test (`test/sync.integration.test.ts`). Landed with the removal of
name-based `syncController` injection from the integration tests (see #19): the
database derives its own topic and exposes `idle()` to await queued sync work, so
tests no longer inject a controller with an arbitrary topic.

### D6. ✅ (mostly) Identity fetches are cached
`HeliaController` now caches resolved identities in a bounded (1024-entry)
insertion-ordered LRU keyed by CID, storing the in-flight promise so concurrent
lookups of the same identity coalesce onto one fetch; failures are not cached.
So many entries from the same writer trigger a single fetch+verify instead of one
per entry — the merge hot-path (`getSigned`/`getSignedV2` → `resolveIdentity`).
Covered by `test/identity-cache.test.ts` (a head + N entries from one foreign writer
resolve that identity exactly once; `identityFetchCount` observes it).
**Remaining:** a global fetch-concurrency limit, and a cheap `kid` prefilter that
rejects a non-member writer *before* fetching its identity (needs a peek-at-`kid`
step in the entry-fetch path) to blunt the unique-CID DoS — follow-ups, not v2
blockers.

### D7. ✅ Delete via logical tombstones
`db.delete(key)` writes a signed tombstone — a delete record in the same composite
LWW order as puts (a versioned put/delete entry union on the existing `SortedEntry`
leaf, per `PHASE_PRIORITIES.md`). While the tombstone wins, the key is hidden from
`get`/`iterator`; a newer `set` resurrects it; the record stays in the Merkle tree
and replicates like any entry. Deletes are authorized like writes (an unauthorized
tombstone is rejected locally and through merge) and survive reopen from the
persisted head. `size` counts Merkle records including tombstones (matches
`head.size`). Covered by `test/delete.test.ts` (5 cases incl. two-node replication
with root convergence). **No GC/compaction in v2** — deferred by design.

### D8. ◻️ No durable head pointer — sync needs a live peer
There is no persistent record of a database's current head. `openDenkmitDatabase()`
fetches only the manifest and consensus rule, then waits for a peer to announce a
head over pubsub (`src/functions/denkmitdb.ts` `openDenkmitDatabase`/`setupSync`).
Consequences (mitigated but not eliminated by #21 and D4):
- ~~A restarted lone node has no state~~ — fixed by D4: a node reopens its **own**
  last head from the local pointer, no peer needed.
- ~~Late joiners miss the one announcement~~ — fixed by #21: heads are re-announced
  periodically.
- Remaining gap: a *fresh* reader (no local pointer) whose data-holding peers are
  all offline still gets nothing. Mitigated in practice by **seeds** — always-on
  daemons with no special authority (`mcp/README.md`) — and to be closed by
  discovery by database address over a DHT plus libp2p relays (ROADMAP.md). A
  durable pointer must stay peer-to-peer: the HTTP head-rendezvous idea was dropped
  as a central component; signed head pointers in the DHT (IPNS-style) remain an
  option.

Pubsub here is only a *notification* (a ~36-byte head CID); all data transfer is
bitswap. The fix is to make head discovery a **configurable strategy** rather than
hardcoded pubsub: offer pubsub (real-time, needs a live libp2p transport) and a
durable, resolvable head pointer (IPNS or equivalent, works for late joiners and
without a live announcer), usable alone or together and selected by config. Note
that a fresh reader also needs reachable **blocks**, not just a head — which is why
seeds and DHT provider records matter more than any pointer.

## Housekeeping

- ✅ `src/functions/polllard/` → `pollard/`; `nexLayerIndex` typo fixed.
- ✅ V1 `addSigned`/`getSigned` (unused `OwnedDataType` variants) deleted; the V2
  methods now carry the plain names. `signWithoutPayload` and the dead
  detached-payload draft removed with them (closes the #6 follow-up).
- Donation badges: the ETH badge showed a BTC address (removed).
