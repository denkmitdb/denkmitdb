# Known Issues

Verified against the code as of July 2026 (Phase 0 review, then hardened by an
independent adversarial review — see `CODEX_REVIEW.md`). Issues with a test
reference are pinned by an `it.fails(...)` case — when the bug is fixed, the pinned
test starts failing as "expected failure passed", which forces flipping it to a
normal test. Numbers are referenced from test comments and ROADMAP.md.

Severity: **Critical** breaks the trust model or the published package; **High**
can corrupt replicated state or defeat convergence; **Medium** is a real defect
with narrower impact; **Low** is misleading or brittle but off the hot path.

## Replication trust — found by the adversarial review

### 10. [Critical] Merged index metadata is unauthenticated
- **Where:** `src/functions/denkmitdb.ts` — `processLeafMerging()`, `handlePollardUpdate()`
- **What:** pollards are stored as **raw, unsigned dag-cbor** (`heliaController.add`,
  not `addSignedV2`). During merge, the consensus check runs against `key`,
  `timestamp` and `creator` copied from the unsigned leaf, and the entry CID is
  indexed **without ever fetching the signed entry** to compare. A malicious peer
  can claim an allowed creator/timestamp for any entry, or misindex a valid signed
  entry under a different key. Any access control built on this merge path is
  bypassable — this must be fixed **before** implementing access control.
- **Fix:** during merge, fetch + signature-verify each entry and require its signed
  `key`/`timestamp`/creator to match the leaf metadata before indexing.

### 11. [High] Heads from foreign databases are accepted
- **Where:** `src/functions/denkmitdb.ts` — `syncNewHead()`
- **What:** a fetched head is loaded/merged without checking
  `head.manifest.equals(this.manifest.cid)` or version compatibility. Combined with
  #4 (or two databases sharing a name/topic, D5), valid state from a *different
  database* contaminates this one.
- **Fix:** validate manifest binding and versions before merge; add malformed-head
  handling.

### 12. [High] `SortedEntry` leaf equality ignores all metadata except the link
- **Where:** `src/functions/polllard/leaf.ts` — `isLeavesEqual()`
- **What:** two `SortedEntry` leaves comparing equal on `link` alone hides differing
  `sort`/`key`/`creator` metadata during tree comparison, so divergent (or
  maliciously altered) index metadata can be invisible to the diff.
- **Fix:** compare all fields for `SortedEntry` leaves.

### 13. [High] Pollard appends race with layer finalization
- **Where:** `src/functions/denkmitdb.ts` — `updateLayers()`; `polllard/pollard.ts` — `append()`
- **What:** `append()` is async but both call sites in `updateLayers()` drop the
  promise, so `updateLayersOneLeaf()` hashing can overlap subsequent appends and
  the final `updateLayers()`, racing CID/hash state.
- **Fix:** await appends (or make append synchronous — the per-leaf incremental
  hashing is redundant with the final `updateLayers()` pass anyway).

### 14. [High] Queue, publish, and message-callback promises are detached
- **Where:** `src/functions/sync.ts` (`newMessage`, `sendHead`, `addTask`), callers in `denkmitdb.ts`
- **What:** `queue.add(...)`, `pubsub.publish(...)` and the `newHead(data)` callback
  are neither returned nor awaited. `set`/`merge`/`load` can resolve before tree
  work completes (so `createHead()` right after an awaited `set()` can see stale
  layers), `sendHead()` resolves before publication, and failures surface as
  unhandled rejections instead of caller errors.
- **Fix:** propagate the promises; give the queue an error channel.

## Correctness bugs — Phase 0 findings (corrections applied)

### 1. [High] Stale reads after sync — merged updates to existing keys are invisible
- **Where:** `src/functions/denkmitdb.ts` — `get()` vs `processLeafMerging()`
- **What:** `get()` consults the Keyv cache first (truthy values short-circuit).
  Merging a remote entry updates `SortedItemsStore` but never invalidates the
  cached value, so a locally-cached key keeps returning its old value until it is
  overwritten locally, evicted, or the database is closed.
- **Fix:** invalidate/overwrite the cache in `processLeafMerging()` — but only
  after determining that the incoming record actually wins (see #2).

### 2. [High] Last-write-wins is not actually last-write-wins
- **Where:** `src/functions/utils/sortedItems.ts` — `set()`
- **What:** two problems in one:
  1. `keyMap.set(key, ...)` is unconditional, so for a given key the record merged
     **last** wins, not the newest timestamp. Merge order between peers determines
     the final value → replicas can permanently disagree.
  2. The superseded record's timestamp entry stays in `sortedMap`, so the index,
     Merkle tree and `size` still contain the stale record.
- **Tests:** `test/sortedItems.test.ts` (two `it.fails` cases; the LWW pin checks
  timestamp, CID **and** creator so a partial fix cannot satisfy it)
- **Fix (order matters):** compare timestamps before overwriting; equal-timestamp
  conflicts need a deterministic tie-break (entry CID) — which requires #3's
  composite key first, because removing "the old timestamp" is unsafe while another
  key may legitimately occupy it. Layer rebuilds after supersede must start at
  `min(oldSortKey, newSortKey)` and truncate stale suffix pollards if the index
  shrank.

### 3. [High] Same-millisecond writes collide and lose data
- **Where:** `src/functions/utils/sortedItems.ts` — index keyed by `Date.now()` ms
- **What:** `OrderedMap.setElement(sortField, ...)` overwrites: two *different keys*
  written in the same millisecond leave only one record in the ordered index, while
  both keys survive in `keyMap` — key lookup and ordered iteration/tree state then
  disagree with each other.
- **Test:** `test/sortedItems.test.ts` (`it.fails`)
- **Fix:** composite sort key `[timestamp, entryCID]` — specified in
  [`specs/ordering.md`](specs/ordering.md); pinned in `test/adversarial.test.ts`.

### 4. [High] Pubsub messages are not filtered by topic
- **Where:** `src/functions/sync.ts` — `newMessage()`
- **What:** the `message` listener fires for every message on **every topic this
  node's pubsub service is subscribed to** and never checks
  `message.detail.topic === this.name`. Two databases on one Helia node cross-feed
  each other's heads. `newHead(data)` is an *unawaited* promise, so
  `CID.decode(garbage)` becomes a detached rejection — a synchronous try/catch
  alone will not contain it (see #14).
- **Fix:** early-return unless the topic matches; make the callback chain awaited
  and error-handled; land together with D5 (topic should be the manifest CID) and
  #11 (manifest validation), since same-name databases still share a topic after
  filtering.

### 5. [High] `merge()` with no `SortedEntry` differences schedules a bogus rebuild
- **Where:** `src/functions/denkmitdb.ts` — `merge()`
- **What:** when the diff contains no `SortedEntry` leaves (e.g. the difference is
  local-only), `smallestTimestamp` remains `Number.MAX_SAFE_INTEGER` and
  `updateLayers` dereferences the end iterator returned by `sortedMap.find()`. The
  crash is then swallowed as a detached queue rejection (#14).
- **Fix:** skip the rebuild when nothing was merged.

### 6. [Medium] `createJWS` can never produce a detached-payload JWS
- **Where:** `src/functions/identity.ts` — `includePayload = includePayload || true`
- **What:** `|| true` forces the flag to `true` even when the caller passed `false`,
  so `signWithoutPayload()` silently includes the payload. The detached-payload
  "V2" storage path in `utils/helia.ts` is commented out; whether this bug is the
  reason is unknown.
- **Fix:** `includePayload = includePayload ?? true`, then decide the detached-JWS
  storage question and delete whichever of the V1/V2 paths loses.

### 7. [Medium] `Pollard.compare(undefined)` throws instead of comparing against empty
- **Where:** `src/functions/polllard/pollard.ts` — `compare()`
- **What:** the signature accepts `other?`, and the body contains an
  `other || createEmptyPollard(...)` fallback — but the order check on the line
  above dereferences `other?.order` first and throws `"Orders are different"`,
  making the fallback dead code.
- **Test:** `test/pollard.test.ts` (`it.fails`)

### 8. [Medium] `Object.assign(x)` used as a clone — it isn't one
- **Where:** `src/functions/polllard/pollard.ts` constructor (`layers`) and `addLeaf`
- **What:** single-argument `Object.assign(x)` returns `x` itself, so the
  constructor aliases the caller's layers (when non-empty) and `addLeaf` aliases
  the caller's leaf. The public `layers` getter and `all()` also hand out live
  internal references.
- **Fix:** explicit copies of layer arrays, leaf objects, hash bytes and `sort`
  arrays. Avoid `structuredClone` here: CID instances don't survive it with their
  class semantics intact.

### 9. [Medium] Lifecycle/teardown leaks
- **Where:** `src/functions/sync.ts`, `src/functions/utils/helia.ts`
- **What:**
  - `close()` calls `removeEventListener("message")` without the original handler
    reference — a no-op, so the listener (and the cross-talk in #4) survives
    `close()`. The `subscription-change` listener is leaked the same way.
  - `addRepetitiveTask`'s in-flight `delay()` timer survives `close()` (it fires
    once more; the chain does not recur because the queue was cleared).
  - Every `TimeoutController` in `HeliaStorage` lives until its 30 s abort fires
    instead of being cleared when the operation finishes.
  - `HeliaStorage.close()` fires `helia.stop()` without awaiting it; `close()` also
    neither drains nor error-handles in-flight queue work.

## API/contract defects (Medium/Low)

### 15. [Medium] `setupSync()` is fire-and-forget
Both factories call `dmdb.setupSync()` without awaiting (`src/functions/denkmitdb.ts`),
so callers can receive a database that is not yet subscribed, and setup errors are
detached.

### 16. [Medium] `createHead()` on an empty database violates its type
`createOnlyNewHead()` returns `undefined` for size 0, and `createHead()` then
returns an actually-undefined `this.head!` behind a non-null assertion.

### 17. [Medium] Public `load()` is additive despite sounding replacement-oriented
`load()` clears the layers but not the sorted index, cache, or previous head —
calling it on a populated database unions old records into the "loaded" state.

### 18. [Medium] Falsy values are mishandled
`get()` treats cached `false`, `0`, `""`, `null` as misses and refetches; and both
`get()`'s post-fetch check and `iterator()` drop falsy values entirely.

### 19. [Medium] Public options are silently ignored
`DenkmitDatabaseOptions` exposes `order`, `sortedItemsStore` and
`consensusController`, but creation hardcodes order 3 and the constant-true
consensus and ignores a custom sorted store; opening additionally ignores a custom
`syncController` (create honours it, open does not).

### 20. [Low] Smaller API defects
- Pollard order 8 is rejected although the error message promises `(0, 8]`
  (`src/functions/polllard/pollard.ts`; pinned in `test/pollard.test.ts`).
- `SortedItemsStore.findPrevious()` reports the *requested* sort field instead of
  the predecessor's, and can dereference an end iterator.
- `getPollardTreeNodeChildren`/`...Left` multiply positions by `order` where the
  branching factor is `maxLength` (2^order). Currently unused internally.

## Packaging & tooling

- **[Fixed 2026-07] Broken ESM output.** v1.0.0's emitted JS used extensionless
  relative specifiers and bare `src/...` imports, so the published entry point
  could not be imported at all. Fixed by moving to `NodeNext` resolution with
  explicit `.js` specifiers; guarded by `scripts/package-smoke.mjs` in CI.
- **[Fixed 2026-07] Stale hand-written type declarations.** `src/types/*` carried
  16 `export declare function` statements duplicating (and in `entry.ts`
  contradicting — `addEntry`/`getEntry` never existed) the real API, and the
  package `types` field pointed at them. The declares are removed and `types` now
  points at the runtime entry's declarations.
- **[Partially fixed 2026-07] `node-datachannel` native build fails on modern Node.**
  Helia 4 statically imports `@libp2p/webrtc` → `node-datachannel`. Inside this
  repository the module is replaced by a stub via `pnpm.overrides`
  (`stubs/node-datachannel`), so `import("helia")` and the examples work.
  **Consumers of the published package are still exposed** — their installs build
  the real native module. Resolved properly by the helia/libp2p upgrade
  (ROADMAP.md), where WebRTC is no longer pulled in unconditionally.

## Design concerns (not bugs, but should be decided deliberately)

### D1. The database is world-writable
The default consensus rule is the constant `true`, and the manifest `access` field
is a placeholder CID with a `TODO`. Signatures prove authorship, but nothing
restricts who may write — and per #10, even authorship metadata is currently
unverified during merge. See ROADMAP.md; access control must precede delete.

### D2. "Consensus" is a local validation predicate, not consensus
Nodes never agree on anything collectively; each node evaluates a json-logic rule
locally. Either rename (write-validation policy) or build actual coordination.

### D3. Wall-clock ordering
`Date.now()` is the entire ordering story. Same-millisecond writes already collide
(#3), and clock skew between writers reorders history. A composite key
`[timestamp, entryCID]` gives a deterministic *total order*; whether wall-clock
time should determine *who wins* (vs. hybrid logical clocks) is a separate,
deliberate decision to make before the wire format is frozen for v2.

### D4. No local persistence of the index or head
`SortedItemsStore` and the pollard layers are memory-only, and `close()` clears
them. A restarted node has an empty database until a peer announces a head.
Caveat: the Keyv cache *can* be caller-provided persistent storage — in which case
`close()` destructively clears a store the caller owns; ownership semantics need
to be defined as part of the persistence work.

### D5. The pubsub topic is the manifest *name*
Databases with the same name — a global namespace — share a topic. The topic should
be derived from the manifest CID. Must land together with #4/#11.

### D6. Unbounded identity fetches
Verifying a foreign entry fetches and verifies the writer's identity from IPFS
every time; there is no identity cache.

### D7. README previously promised record deletion
There is no delete/tombstone support in the code. The claim has been removed from
the README; tombstones are planned in ROADMAP.md **after** access control.

## Housekeeping

- Directory `src/functions/polllard/` is a typo (three l's) — rename in a major
  version to avoid breaking deep imports.
- `schdeduleQueue` (SyncController) and `nexLayerIndex` (pollard.ts) typos.
- `getSigned`/`addSigned` (V1) duplicate `getSignedV2`/`addSignedV2`; consolidate
  when the detached-payload question (#6) is settled.
- Donation badges in README: the ETH badge showed a BTC address (ETH badge removed
  until a real address is provided).
