# Known Issues

Status as of the Phase 2 correctness work (July 2026). Each item is tagged:

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

### 8b/20. ◻️ [Low] Public getters expose internal references; helper arithmetic
`Pollard.layers` and `all()` return the live internal arrays (callers can mutate
them). `getPollardTreeNodeChildren`/`...Left` multiply positions by `order` where
the branching factor is `maxLength` (2^order); both are currently unused
internally. Scheduled with the Phase 4 cleanup.

### 19. ◻️ [Medium] Some public options are ignored — and some must stay that way
`DenkmitDatabaseOptions` exposes `order`, `sortedItemsStore`, `syncController` and
`consensusController`; creation hardcodes order 3 and the constant-true consensus
and ignores a custom sorted store, and **open also silently ignores a custom
`syncController`** (create honours it). The fix is *not* "honour them all" — several
are convergence-hazardous:
- `order` — honour on create only; open must use the signed manifest value.
- open-time policy override (`consensusController`) — must **never** be honoured;
  policy is part of database identity, and a local override destroys convergence.
- `sortedItemsStore` — remove the injection point; it's protocol-critical state
  (ordering/LWW invariants), not a casual adapter.
- `syncController` — replace with the discovery-strategy interface (D8).
Scheduled in ROADMAP.md Phase 4 step 1 (D2/#19 API decisions).

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

## Packaging & tooling

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

### D1. ◻️ The database is world-writable
The default consensus rule is the constant `true` and the manifest `access` field
is a placeholder. Writes are now *authenticated* (#10) — every indexed entry is
signed by a known identity — but not *authorized*: any identity may write.
Access control is ROADMAP.md Phase 4, and must precede delete.

### D2. ◻️ "Consensus" is a local validation predicate, not consensus
Each node evaluates a json-logic rule locally; nodes never agree collectively.
Rename to write-validation policy, or build real coordination.

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

### D4. ◻️ No local persistence; `close()` clears caller-owned cache
`SortedItemsStore` and the pollard layers are memory-only. `close()` still
`clear()`s the Keyv cache even when the caller supplied a persistent store —
ownership semantics to be defined with the Phase 4 persistence work.

### D5. ✅ The pubsub topic is now the manifest CID
Was the manifest *name*, so distinct databases sharing a name shared a topic and
received each other's (rejected-but-fetched) announcements. **Fixed:** the topic is
`syncTopic(manifest.cid)` = `/denkmitdb/2/<manifest-cid>` — versioned and
manifest-scoped. Covered by a topic-derivation assertion plus the existing two-node
sync test (`test/sync.integration.test.ts`). Landed with the removal of
name-based `syncController` injection from the integration tests (see #19): the
database derives its own topic and exposes `idle()` to await queued sync work, so
tests no longer inject a controller with an arbitrary topic.

### D6. ◻️ Unbounded identity fetches — now a release concern + DoS vector
Verifying a foreign entry fetches its identity, verifies its self-signature, decodes
it, constructs an `Identity`, and imports its key — **per entry, serially, in merge
and load** — with no cache. Authenticated merge (#10) made this a hot path, and it's
a DoS multiplier: an attacker can advertise many entries or many unique identity
CIDs and force network/crypto work before rejection. The 53-test suite uses tiny
datasets and never measures it. Bounded LRU + in-flight coalescing + fetch
concurrency limits, before v2 (ROADMAP.md Phase 4 step 3). Access control enables a
cheap `kid` prefilter but does not remove the need for caching.

### D7. ◻️ Delete is unimplemented
No delete/tombstone support. Scheduled in ROADMAP.md Phase 4 step 5 — after access
control (step 2) and persistence (step 4), which it depends on for authorization and
a restart test-bed. Logical tombstones only (no GC) for v2.

### D8. ◻️ No durable head pointer — sync needs a live peer
There is no persistent record of a database's current head. `openDenkmitDatabase()`
fetches only the manifest and consensus rule, then waits for a peer to announce a
head over pubsub (`src/functions/denkmitdb.ts` `openDenkmitDatabase`/`setupSync`).
Consequences (worsened by #21 — heads are only announced when the root *changes*,
never re-broadcast on a timer):
- A node that opens the database when no data-holding peer is currently
  online-and-connected stays **empty** — it never learns any head.
- A late joiner gets nothing until some peer performs a *new write* that changes the
  root and re-announces; there is no periodic re-broadcast to catch (#21).
- A restarted lone node has no state and, being quiet, announces nothing.

Pubsub here is only a *notification* (a ~36-byte head CID); all data transfer is
bitswap. The fix is to make head discovery a **configurable strategy** rather than
hardcoded pubsub: offer pubsub (real-time, needs a live libp2p transport) and a
durable, resolvable head pointer (IPNS or equivalent, works for late joiners and
over HTTP-only), usable alone or together and selected by config. See ROADMAP.md
("Pluggable head discovery"). This also loosens the libp2p-pubsub coupling that
makes helia 7 / HTTP-only nodes awkward, and overlaps with D5 (topic = manifest
CID) and D4 (local persistence).

## Housekeeping

- Directory `src/functions/polllard/` is a typo (three l's) — rename in a major
  version (breaks deep imports).
- `nexLayerIndex` (pollard.ts) typo; `getSigned`/`addSigned` (V1) duplicate the V2
  methods — consolidate with the jose decision (#6).
- Donation badges: the ETH badge showed a BTC address (removed).
