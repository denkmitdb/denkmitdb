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

### 19. ◻️ [Medium] Some public options are still ignored
`DenkmitDatabaseOptions` exposes `order`, `sortedItemsStore` and (on open)
`consensusController`, but creation still hardcodes order 3 and the constant-true
consensus and ignores a custom sorted store. Either honour or remove these —
carried forward from Phase 2 to the access-control work (they interact with the
consensus/manifest wiring). No behaviour depends on them today.

## Packaging & tooling

- **✅ [Fixed 0.5] Broken ESM output** — NodeNext resolution with explicit `.js`
  specifiers; guarded by `scripts/package-smoke.mjs` in CI.
- **✅ [Fixed 0.5] Stale hand-written type declarations** — removed; `types` points
  at the runtime entry's declarations.
- **◻️ [Partial] `node-datachannel` native build fails on modern Node.** Stubbed
  repo-wide via `pnpm.overrides` (`stubs/node-datachannel`) so this repo works;
  **consumers of the published package are still exposed**. Resolved properly by
  the helia/libp2p upgrade (ROADMAP.md Phase 3), which drops the unconditional
  WebRTC import.

## Design concerns

### D1. ◻️ The database is world-writable
The default consensus rule is the constant `true` and the manifest `access` field
is a placeholder. Writes are now *authenticated* (#10) — every indexed entry is
signed by a known identity — but not *authorized*: any identity may write.
Access control is ROADMAP.md Phase 4, and must precede delete.

### D2. ◻️ "Consensus" is a local validation predicate, not consensus
Each node evaluates a json-logic rule locally; nodes never agree collectively.
Rename to write-validation policy, or build real coordination.

### D3. ◻️ Wall-clock ordering (bounded)
Ordering uses wall-clock timestamps with the entry-CID tie-break (a deterministic
total order — see `specs/ordering.md`). Clock skew still decides *which* write
wins a conflict; a merge-time future-skew bound is specified but the default
consensus rule does not yet enforce it (the constant-true rule accepts everything).
HLC is deferred with a compatible upgrade path.

### D4. ◻️ No local persistence; `close()` clears caller-owned cache
`SortedItemsStore` and the pollard layers are memory-only. `close()` still
`clear()`s the Keyv cache even when the caller supplied a persistent store —
ownership semantics to be defined with the Phase 4 persistence work.

### D5. ◻️ The pubsub topic is the manifest *name*
Same-name databases share a topic. The manifest-binding check (#11) prevents
cross-contamination, but the topic should still be the manifest CID. Land with the
Phase 3 libp2p work.

### D6. ◻️ Unbounded identity fetches
Verifying a foreign entry fetches its identity from IPFS every time; no cache.
Note: authenticated merge (#10) makes this hotter, so the identity cache moves up
in priority.

### D7. ◻️ Delete is unimplemented
No delete/tombstone support. Scheduled in ROADMAP.md Phase 4, after access control.

## Housekeeping

- Directory `src/functions/polllard/` is a typo (three l's) — rename in a major
  version (breaks deep imports).
- `nexLayerIndex` (pollard.ts) typo; `getSigned`/`addSigned` (V1) duplicate the V2
  methods — consolidate with the jose decision (#6).
- Donation badges: the ETH badge showed a BTC address (removed).
