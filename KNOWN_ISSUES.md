# Known Issues

Verified against the code as of July 2026 (Phase 0 review). Issues marked with a
test reference are pinned by an `it.fails(...)` case — when the bug is fixed, the
pinned test starts failing as "expected failure passed", which forces flipping it to
a normal test. Numbers are referenced from test comments and ROADMAP.md.

## Correctness bugs

### 1. Stale reads after sync — merged updates to existing keys are invisible
- **Where:** `src/functions/denkmitdb.ts` — `get()` vs `processLeafMerging()`
- **What:** `get()` consults the Keyv cache first. Merging a remote entry updates
  `SortedItemsStore` but never invalidates the cached value for that key, so a key
  that was read (or written) locally keeps returning its old value forever, even
  after a newer remote entry for it was merged.
- **Fix:** delete/overwrite the Keyv entry inside `processLeafMerging()`.

### 2. Last-write-wins is not actually last-write-wins
- **Where:** `src/functions/utils/sortedItems.ts` — `set()`
- **What:** two problems in one:
  1. `keyMap.set(key, ...)` is unconditional, so for a given key the record merged
     **last** wins, not the record with the newest timestamp. Merge order between
     peers then determines the final value → replicas can permanently disagree.
  2. The superseded record's timestamp entry is never removed from `sortedMap`, so
     the index (and therefore the Merkle tree and `size`) still contains the stale
     record.
- **Tests:** `test/sortedItems.test.ts` (two `it.fails` cases)
- **Fix:** compare timestamps before overwriting; remove the old `sortedMap` entry
  when a key is superseded.

### 3. Same-millisecond writes collide and lose data
- **Where:** `src/functions/utils/sortedItems.ts` — index keyed by `Date.now()` ms
- **What:** `OrderedMap.setElement(sortField, ...)` overwrites: two *different keys*
  written in the same millisecond leave only one record in the index.
- **Test:** `test/sortedItems.test.ts` (`it.fails`)
- **Fix:** composite sort key `[timestamp, entryCID]` (breaking wire-format change —
  scheduled for v2 in the roadmap).

### 4. Pubsub messages are not filtered by topic
- **Where:** `src/functions/sync.ts` — `newMessage()`
- **What:** the `message` listener fires for **every** gossipsub message on the node
  and never checks `message.detail.topic === this.name`. Two databases on one Helia
  node cross-feed each other's heads; any other protocol's message reaches
  `CID.decode(garbage)`, which throws inside the event listener.
- **Fix:** early-return unless the topic matches; wrap the handler body in try/catch.

### 5. `merge()` with no `SortedEntry` differences schedules a bogus rebuild
- **Where:** `src/functions/denkmitdb.ts` — `merge()`
- **What:** when the diff contains no `SortedEntry` leaves, `smallestTimestamp`
  remains `Number.MAX_SAFE_INTEGER` and `updateLayers` dereferences the end iterator
  returned by `sortedMap.find()` — a crash path.
- **Fix:** skip the rebuild when nothing was merged.

### 6. `createJWS` can never produce a detached-payload JWS
- **Where:** `src/functions/identity.ts` — `includePayload = includePayload || true`
- **What:** `|| true` forces the flag to `true` even when the caller passed `false`,
  so `signWithoutPayload()` silently includes the payload. This is likely why the
  detached-payload "V2" storage path in `utils/helia.ts` is commented out.
- **Fix:** `includePayload = includePayload ?? true`.

### 7. `Pollard.compare(undefined)` throws instead of comparing against empty
- **Where:** `src/functions/polllard/pollard.ts` — `compare()`
- **What:** the signature accepts `other?`, and the body contains an
  `other || createEmptyPollard(...)` fallback — but the order check on the line
  above dereferences `other?.order` first and throws `"Orders are different"`,
  making the fallback dead code.
- **Test:** `test/pollard.test.ts` (`it.fails`)

### 8. `Object.assign(x)` used as a clone — it isn't one
- **Where:** `src/functions/polllard/pollard.ts` constructor (`layers`) and `addLeaf`
- **What:** single-argument `Object.assign(x)` returns `x` itself. The constructor
  therefore aliases the caller's `layers` array and `addLeaf` aliases the caller's
  leaf. Mutations flow through shared references.
- **Fix:** `structuredClone`, spread, or explicit copies.

### 9. Lifecycle/teardown leaks
- **Where:** `src/functions/sync.ts`, `src/functions/utils/helia.ts`
- **What:**
  - `close()` calls `removeEventListener("message")` without the original handler
    reference — a no-op, so the listener (and cross-DB cross-talk, see #4) survives
    `close()`.
  - `addRepetitiveTask`'s 30 s `delay()` timer keeps running after `close()`.
  - Every `TimeoutController` in `HeliaStorage` is created and never `clear()`ed.
  - `HeliaStorage.close()` fires `helia.stop()` without awaiting it.

## Design concerns (not bugs, but should be decided deliberately)

### D1. The database is world-writable
The default consensus rule is the constant `true`, and the manifest `access` field
is a placeholder CID with a `TODO`. Signatures prove authorship, but nothing
restricts who may write. See `test/consensus.test.ts` for the pinned behaviour and
ROADMAP.md Phase 3 for the plan.

### D2. "Consensus" is a local validation predicate, not consensus
Nodes never agree on anything collectively; each node evaluates a json-logic rule
locally. The naming overpromises — either rename (write-validation policy) or build
actual coordination.

### D3. Wall-clock ordering
`Date.now()` is the entire ordering story. Clock skew between writers silently
reorders history and, combined with #2, can lose writes. Hybrid logical clocks are
the standard fix.

### D4. No local persistence of the index or head
`SortedItemsStore`, the pollard layers, and the Keyv cache are memory-only, and
`close()` clears them. A restarted node has an empty database until a peer announces
a head. There is also no `load`-from-local-head on `openDenkmitDatabase`.

### D5. The pubsub topic is the manifest *name*
Databases with the same name — a global namespace — share a topic. The topic should
be derived from the manifest CID (the actual database address).

### D6. Unbounded identity fetches
Verifying a foreign entry fetches and verifies the writer's identity from IPFS every
time; there is no identity cache.

### D7. README previously promised record deletion
There is no delete/tombstone support in the code. The claim has been removed from
the README; tombstones are planned in ROADMAP.md Phase 3.

## Housekeeping

- Directory `src/functions/polllard/` is a typo (three l's) — rename in a major
  version to avoid breaking deep imports.
- `schdeduleQueue` (SyncController) and `nexLayerIndex` (pollard.ts) typos.
- `getSigned`/`addSigned` (V1) duplicate `getSignedV2`/`addSignedV2` and are unused
  except by identity fetching; consolidate.
- Donation badges in README: the ETH badge shows a BTC address.
