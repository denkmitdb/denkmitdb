# Adversarial review of `dcf7e62`

Reviewed at `main` commit `dcf7e62` on 2026-07-16. Severity means:

- **Critical:** breaks the trust model or makes the published package unusable.
- **High:** can corrupt/contaminate replicated state, defeat convergence, or invalidate the safety net.
- **Medium:** real correctness, lifecycle, API, or coverage defect with narrower impact.
- **Low:** misleading, brittle, or incomplete but not currently on a hot path.

## 1. `ROADMAP.md`

### [High] Runtime-major upgrades are ordered before the behavior they are meant to preserve is specified and tested

Phase 1 upgrades Helia 4→7 and libp2p 1→3 while known replication failures remain encoded as expected test failures (`ROADMAP.md:20-34`, `test/sortedItems.test.ts:59-90`). The only two-node test loads two new, disjoint keys in one direction; it does not exercise merge conflicts, cached updates, reverse delivery, malformed heads, or multiple databases (`test/sync.integration.test.ts:56-81`). A green Phase 1 would therefore establish API compatibility with that narrow happy path, not preservation of correct database behavior.

Do tooling-only upgrades independently, but move the replication correctness work ahead of runtime-major upgrades. Where an upgrade and fix touch the same surface, combine them deliberately: Helia/libp2p with topic/listener/teardown changes; JOSE with the detached-payload decision.

### [Critical] The roadmap omits authentication of replicated index metadata

`processLeafMerging()` runs policy checks against `key`, `timestamp`, and `creator` copied from an unsigned Pollard leaf and indexes its CID without fetching the signed entry or comparing the leaf fields with it (`src/functions/denkmitdb.ts:364-381`, `src/functions/denkmitdb.ts:441-444`). This permits a peer to claim an allowed creator/timestamp or misindex a valid signed entry under another key. Access control built on the current merge path would be bypassable. This must precede Phase 3 access control and should be the first correctness item.

### [High] Foreign-head validation is missing

Heads contain a manifest CID, but `syncNewHead()` loads/merges a fetched head without checking `head.manifest.equals(this.manifest.cid)` or validating compatible versions (`src/functions/head.ts:23-29`, `src/functions/denkmitdb.ts:554-565`). Topic filtering is not an isolation boundary. Add manifest/version validation and malformed/foreign-head tests to correctness work.

### [High] #4 and D5 must land together

Filtering `message.detail.topic` fixes unrelated-topic delivery, but databases with the same name still deliberately share a topic because both create/open pass `manifest.name` (`ROADMAP.md:40`, `ROADMAP.md:65`, `src/functions/denkmitdb.ts:72`, `src/functions/denkmitdb.ts:103`). Move “topic = manifest CID” from Phase 3 into the #4 fix.

### [High] The wire-format change has no compatibility plan

The composite sort key changes persisted `SortedEntry.sort`, yet the roadmap only says to publish npm 2.0.0 (`ROADMAP.md:42-44`, `ROADMAP.md:67-73`). Pollard/leaf readers do not reject incompatible versions (`src/functions/polllard/pollard.ts:35-56`, `src/types/leaf.ts:35-46`). Define a deterministic equal-timestamp tie-break, bump the persisted format, and specify old-block/old-peer rejection or migration. Move D3's clock representation decision forward; otherwise Phase 2 and Phase 3 may each change ordering format.

### [High] Delete is ordered before authorization

Phase 3 lists delete before access control (`ROADMAP.md:56-60`) while the database is world-writable (`KNOWN_ISSUES.md:88-92`). Replicated tombstones would let every peer delete every key. Access control and authenticated merge metadata must precede delete support.

### [Medium] Merge/load atomicity and async failure handling are absent

`merge()` and `load()` mutate the index incrementally, and `load()` clears layers before validation completes (`src/functions/denkmitdb.ts:312-319`, `src/functions/denkmitdb.ts:516-545`). A rejected leaf can leave partial state. Queue tasks, Pollard appends, and publication promises are also discarded (`src/functions/denkmitdb.ts:384-387`, `src/functions/denkmitdb.ts:409`, `src/functions/denkmitdb.ts:422`, `src/functions/sync.ts:44-50`). Correctness scope needs staged/atomic ingestion and explicit propagation of async failures.

### Recommended ordering

1. Keep Phase 0, but immediately add package/runtime smoke tests and adversarial pins.
2. Specify the versioned ordering format and tie-break (including the D3 decision).
3. Authenticate leaf metadata against fetched signed entries; validate head manifest/version; make ingestion atomic.
4. Fix #2/#3, then #1/#5 and Pollard equality/async races. Fix #7/#8 where their APIs remain relevant.
5. Perform tooling-only upgrades at any convenient point.
6. Upgrade Helia/libp2p together with #4, D5, and lifecycle work; upgrade JOSE together with #6; then upgrade remaining runtime dependencies.
7. Implement access control before tombstones/delete, then persistence, benchmarks, and the v2 release.

## 2. `KNOWN_ISSUES.md`

### Numbered-claim verification

1. **[High] Confirmed, wording too absolute.** Truthy cached values bypass the updated index (`src/functions/denkmitdb.ts:193-201`) and merge does not invalidate the cache (`src/functions/denkmitdb.ts:364-381`). “Forever” means until overwrite, eviction/clear, or close; falsy cached values do not take the early return. The proposed invalidation must happen only after determining that the incoming record won.

2. **[High] Confirmed, fix incomplete.** `keyMap` is overwritten unconditionally and stale timestamp records remain in `sortedMap` (`src/functions/utils/sortedItems.ts:14-17`). Removing an old timestamp is unsafe until #3 is fixed because another key may occupy it. Equal-timestamp updates to the same key also need a deterministic CID tie-break. Rebuilding must begin at `min(oldSortKey, newSortKey)` and truncate stale suffix pollards when removal shrinks the index (`src/functions/denkmitdb.ts:390-425`).

3. **[High] Confirmed, impact understated.** `Date.now()` feeds a numeric-keyed `OrderedMap` (`src/functions/entry.ts:54-58`, `src/functions/utils/sortedItems.ts:6-16`). On collision, the overwritten key still remains in `keyMap`, so key lookup and ordered iteration/tree state disagree (`src/functions/utils/sortedItems.ts:19-30`).

4. **[High] Confirmed with corrections.** The listener sees every gossipsub message for topics subscribed by that pubsub service, not literally every protocol message on the node (`src/functions/sync.ts:24-29`, `src/functions/sync.ts:37-41`). `newHead(data)` is an unawaited promise, so malformed CID decoding becomes a detached rejection; a synchronous `try/catch` alone is insufficient (`src/functions/sync.ts:28`, `src/functions/denkmitdb.ts:554-565`). Topic-CID isolation and head-manifest validation are also required.

5. **[High] Confirmed.** A local-only difference leaves `smallestTimestamp` at `MAX_SAFE_INTEGER`, then an end iterator is dereferenced (`src/functions/denkmitdb.ts:306-320`, `src/functions/utils/sortedItems.ts:34-37`). The resulting failure is detached because queue promises are discarded.

6. **[Medium] Confirmed, but remove the speculation.** `includePayload = includePayload || true` makes the false branch unreachable (`src/functions/identity.ts:210-227`). `?? true` is the appropriate defaulting fix with the installed JOSE behavior. The statement that this is “likely why” V2 was commented out is not supported by source evidence.

7. **[Medium] Confirmed.** The order comparison rejects `undefined` before the fallback (`src/functions/polllard/pollard.ts:367-378`).

8. **[Medium] Confirmed, proposed fix needs care.** Single-argument `Object.assign` aliases non-empty constructor layers and added leaves (`src/functions/polllard/pollard.ts:45-47`, `src/functions/polllard/pollard.ts:108-116`). Constructor aliasing does not occur for length zero. `structuredClone` is risky for CID class semantics; explicitly copy arrays, leaf objects, byte arrays, and `sort` arrays. Public getters also expose mutable references (`src/functions/polllard/pollard.ts:119-121`, `src/functions/polllard/pollard.ts:244-277`).

9. **[High/Medium/Low] Confirmed but incomplete.** The anonymous message callback cannot be removed (`src/functions/sync.ts:37`, `src/functions/sync.ts:59-64`), and the `subscription-change` callback is also leaked (`src/functions/sync.ts:38-40`). Clearing the schedule queue cannot cancel its currently running delay, but that timer ends after the interval rather than recurring forever (`src/functions/sync.ts:52-57`). Storage timeout controllers remain until their 30-second abort instead of being cleared when operations finish (`src/functions/utils/helia.ts:98-132`). `HeliaStorage.close()` also fails to await `helia.stop()` (`src/functions/utils/helia.ts:139-141`). Add that close neither waits for running queue work nor handles its failures.

### Important bugs missing from the list

### [Critical] Replicated metadata is unauthenticated

Unsigned `SortedEntry` metadata drives both consensus and indexing without comparison to the signed entry (`src/functions/denkmitdb.ts:364-381`, `src/functions/denkmitdb.ts:441-444`). This is a direct policy-bypass and data-integrity defect, not merely a future access-control concern.

### [High] Foreign databases' heads are accepted

`syncNewHead()` never binds the fetched head to the open manifest (`src/functions/denkmitdb.ts:554-565`). Combined with #4 or a same-name topic, valid state from another database can contaminate this one.

### [High] `SortedEntry` equality ignores all metadata except link CID

`isLeavesEqual()` considers two `SortedEntry` leaves equal when only their links match, ignoring `sort`, `key`, and `creator` (`src/functions/polllard/leaf.ts:43-56`). Pollard comparison can therefore hide differing/malicious index metadata even though serialized Pollard CIDs differ.

### [High] Pollard appends race with layer finalization

`Pollard.append()` is async, but both calls in `updateLayers()` are unawaited (`src/functions/denkmitdb.ts:406-424`, `src/functions/polllard/pollard.ts:66-101`). Their `updateLayersOneLeaf()` operations can overlap each other and the final `updateLayers()`, racing CID/hash state.

### [High] Queue, publish, and callback promises are detached

`queue.add`, pubsub `publish`, and `newHead` are not returned/awaited (`src/functions/sync.ts:24-29`, `src/functions/sync.ts:44-50`). Consequently `set`/`merge`/`load` can resolve before tree work, `sendHead()` before publication, and failures can become unhandled rejections. `createHead()` immediately after awaited `set()` can see missing/stale layers.

### [Medium] Setup completion/errors are fire-and-forget

Both factories call but do not await `setupSync()` (`src/functions/denkmitdb.ts:82-84`, `src/functions/denkmitdb.ts:115-117`). In the current implementation, listener registration happens synchronously before `start()` returns, but the factory still does not observe completion and any rejected setup promise is detached. This becomes a subscription race as soon as `start()` performs genuinely asynchronous setup.

### [Medium] Empty `createHead()` violates its return type

For size zero, `createOnlyNewHead()` returns `undefined`; `createHead()` then returns an actually undefined `this.head` behind a non-null assertion (`src/functions/denkmitdb.ts:250-271`).

### [Medium] `load()` is additive despite sounding replacement-oriented

Public `load()` clears layers but not the sorted index, cache, or old head (`src/functions/denkmitdb.ts:516-545`). Calling it on a populated database unions old records into the loaded state.

### [Medium] Falsy values are mishandled

`get()` treats cached `false`, `0`, `""`, and `null` as misses, while `iterator()` drops them entirely (`src/functions/denkmitdb.ts:193-213`).

### [Medium] Public options are silently ignored

The API exposes `order`, `sortedItemsStore`, `consensusController`, and `syncController` (`src/types/denkmitdb.ts:111-119`). Creation hardcodes order 3 and constant-true consensus and ignores the custom sorted store (`src/functions/denkmitdb.ts:52-72`, `src/functions/denkmitdb.ts:137-145`); opening additionally ignores a custom sync controller (`src/functions/denkmitdb.ts:96-116`).

### [Low] Additional API defects

- Order 8 is rejected despite the error/test contract saying `(0, 8]` (`src/functions/polllard/pollard.ts:35-38`, `test/pollard.test.ts:14-17`).
- `findPrevious()` reports the requested sort field rather than the predecessor's and can dereference an end iterator (`src/functions/utils/sortedItems.ts:39-42`).
- Pollard child helpers multiply positions by `order` rather than `maxLength`; for order 3 the branching factor is 8, not 3 (`src/functions/denkmitdb.ts:466-493`). They currently appear unused internally.

The design concerns D1, D2, D3, D5, D6, and D7 are supported. D4 is too absolute: Keyv can be caller-provided persistent storage (`src/types/denkmitdb.ts:111-119`), and `close()` clears that caller-owned store (`src/functions/denkmitdb.ts:221-225`).

## 3. `ARCHITECTURE.md`

### [Critical] The signing/authentication description is false

The document says every persisted object/block is JWS-wrapped and that nothing can be forged without a private key (`ARCHITECTURE.md:3-7`, `ARCHITECTURE.md:38-39`, `ARCHITECTURE.md:134-139`). Pollards are raw unsigned DAG-CBOR (`src/functions/denkmitdb.ts:441-444`, `src/functions/denkmitdb.ts:548-551`), and their unauthenticated metadata drives policy and indexing. CIDs protect content integrity, not truth or authorization. Rewrite the trust model and sequence around signed entries/heads versus unsigned Pollards.

### [High] Sync does not prefetch/verify entries as diagrammed

The sequence says B fetches missing entry blocks before consensus and merge (`ARCHITECTURE.md:119-123`). Actual load/merge fetches Pollards and indexes leaf metadata; the signed entry is fetched lazily only on `get()` (`src/functions/denkmitdb.ts:312-319`, `src/functions/denkmitdb.ts:516-545`, `src/functions/denkmitdb.ts:193-201`). This is also why the documented authentication guarantee does not hold during merge.

### [High] “Canonical index/cache always current” is false

The document labels `SortedItemsStore` canonical and says index/cache are always current (`ARCHITECTURE.md:53-59`, `ARCHITECTURE.md:177-179`). #1-#3 allow stale caches, duplicate stale records, and split keyMap/sortedMap state (`src/functions/utils/sortedItems.ts:14-30`, `src/functions/denkmitdb.ts:193-201`, `src/functions/denkmitdb.ts:364-381`).

### [High] The published API surface is not loadable

The source-layout section calls `src/functions` the published surface (`ARCHITECTURE.md:147-164`), but emitted ESM retains extensionless relative imports under `type: module` (`package.json:5-20`, `tsconfig.json:3-10`, `src/functions/index.ts:1-10`). After a fresh successful `pnpm build`, `node -e "import('./dist/functions/index.js')"` fails with `ERR_MODULE_NOT_FOUND` for `dist/functions/entry`.

### [Medium] “Rebuilt on open/load” is incorrect

`openDenkmitDatabase()` fetches only manifest/consensus and waits for a peer head (`src/functions/denkmitdb.ts:96-118`). `load()` reconstructs layers and sorted items, but not Keyv, which remains lazy (`src/functions/denkmitdb.ts:516-545`, `src/functions/denkmitdb.ts:193-201`). Correct `ARCHITECTURE.md:61-63` accordingly.

### [Medium] Deterministic convergence is stated as an unconditional guarantee

`ARCHITECTURE.md:87-91` says the same entry set always yields the same root independent of learning order. Timestamp collisions overwrite by insertion order (`src/functions/utils/sortedItems.ts:14-17`), and `SortedEntry` comparison ignores metadata. The later caveat at `ARCHITECTURE.md:169-173` does not repair the earlier absolute claim.

### [Medium] The queue serializes; it does not batch

Every set enqueues its own rebuild and `addTask` performs no coalescing (`ARCHITECTURE.md:177-179`, `src/functions/denkmitdb.ts:168-181`, `src/functions/sync.ts:48-50`). Under sustained writes the head can lag by an arbitrary backlog, not “at most one queue drain.”

### [Medium] Complexity omits database-tree height and fetch costs

The `O(diff · order)` claim (`ARCHITECTURE.md:126-128`) covers only work inside one Pollard. Database comparison recursively descends differing Pollard layers (`src/functions/denkmitdb.ts:322-361`). A defensible bound must include database-layer height and network/block fetches.

### [Medium] Keyv is not necessarily in-memory or database-owned

The document categorizes Keyv as in-memory/discardable (`ARCHITECTURE.md:51-63`), but callers may supply a persistent Keyv and `close()` clears it (`src/types/denkmitdb.ts:111-119`, `src/functions/denkmitdb.ts:137-145`, `src/functions/denkmitdb.ts:221-225`). Document ownership/destructive-close semantics or stop clearing caller-owned storage.

### [Medium] “Default order 3” and configurable-policy implications are misleading

Order 3 and constant-true consensus are hardcoded; exposed overrides are ignored (`ARCHITECTURE.md:45`, `ARCHITECTURE.md:49`, `src/types/denkmitdb.ts:111-119`, `src/functions/denkmitdb.ts:52-72`). Say “fixed at 3/currently constant true” until options work.

### [Low] Timestamps do not provide a total order

Equal millisecond values exist, so timestamps alone are not a total order despite `ARCHITECTURE.md:169-171`. A composite key can establish a deterministic total order; wall-clock trust and LWW semantics are separate concerns.

## 4. Test suite (`test/`)

### [High] The suite misses the highest-risk known and newly found paths

There are no pins for #1, #4, #5, #6, #8, or #9, and no tests for authenticated leaf metadata, foreign manifests, `SortedEntry` metadata equality, unawaited Pollard races, falsy values, empty heads, public `load()` replacement semantics, or ignored options (`KNOWN_ISSUES.md:10-84`, `test/sync.integration.test.ts:56-81`). The current integration test proves only empty-node A→B load with two truthy, disjoint values.

### [High] Package and normal-runtime imports are entirely untested

Tests import TypeScript source through Vite aliases (`test/database.test.ts:2-7`, `vitest.config.ts:5-16`). They cannot detect broken emitted ESM or the fact that importing `helia` outside Vitest fails after the configured skipped native build. Add `pnpm pack` plus install/import/type-consumer smoke tests without Vite aliases.

### [Medium] `database.test.ts` is order-dependent

One database is shared through `beforeAll`, and later tests assume keys/heads created earlier (`test/database.test.ts:17-31`, `test/database.test.ts:42-87`). Running only “iterates over all entries in write order” fails because the fixture is empty. Use isolated setup per test or make each case establish its own state.

### [Medium] The iteration test does not test order

It collects output into an object, which tests membership and overwrites duplicate keys, not sequence (`test/database.test.ts:56-62`). Assert an ordered array of tuples, including overwrite and falsy-value cases.

### [Medium] Pollard boundary assertion is wrong/incomplete

The title says `(0, 8]`, but it tests only 0 and 9 while implementation rejects 8 (`test/pollard.test.ts:14-17`, `src/functions/polllard/pollard.ts:35-38`). Explicitly assert order 8 succeeds or change the contract and message.

### [Medium] `it.fails` is sound only as a temporary, narrow pin

All four pins currently fail for the intended defects (`test/sortedItems.test.ts:61-90`, `test/pollard.test.ts:99-107`), so the approach is useful. However, `it.fails` accepts any setup/implementation throw as the expected failure. Keep setup minimal, ensure the intended final assertion is what fails, and convert immediately when fixed. The LWW pin checks only `sortField`, so a partial fix retaining the wrong CID/creator could pass (`test/sortedItems.test.ts:71-78`). The normal “single logical record” test is misleading because it omits size/iteration and passes while two physical records remain (`test/sortedItems.test.ts:49-57`).

### [Low] The default-consensus test does not test database wiring

It constructs a fresh constant-true controller rather than checking what `createDenkmitDatabase()` installed (`test/consensus.test.ts:48-60`, `src/functions/denkmitdb.ts:52-59`). It would pass if factory wiring regressed.

### [Low] Global 60-second unit-test timeouts slow failure detection

The extended limits apply to every test, although only integration tests need them (`vitest.config.ts:18-29`). Scope long timeouts to integration tests and keep unit tests fail-fast.

## 5. CI and `package.json`

### [Critical] Build success does not mean the package can be imported

`pnpm build` succeeds, but the ESM entry point cannot be loaded because TypeScript emits extensionless relative specifiers (`package.json:5-20`, `package.json:25`, `tsconfig.json:3-10`, `src/functions/index.ts:1-10`). CI only builds; it never imports packed output (`.github/workflows/ci.yml:31-38`). A fresh smoke import failed with `ERR_MODULE_NOT_FOUND: .../dist/functions/entry`.

### [Critical] `neverBuiltDependencies` makes the documented development runtime fail while Vitest hides it

The repository skips `node-datachannel`'s native build (`package.json:98-103`) and Vitest aliases it to a stub while inlining Helia (`vitest.config.ts:9-25`). Outside Vitest, a fresh `import('helia')` fails with `MODULE_NOT_FOUND: ../build/Release/node_datachannel.node`. The README quickstart imports Helia (`README.md:65-85`), so normal local usage is broken even though CI is green. Remove the blanket skip, avoid the dependency through a supported Helia/libp2p composition, or provide an equivalent runtime alias—not a test-only illusion.

### [High] Published declarations are stale and use unresolved internal aliases

The package's `types` target is `dist/types/index.d.ts` while runtime exports come from `dist/functions/index.js` (`package.json:5-20`). The mirrored declarations advertise `addEntry/getEntry`, but runtime implements `createEntry/fetchEntry` (`src/types/entry.ts:22-23`, `src/functions/entry.ts:48-80`), and emitted declarations retain imports such as `src/functions` that consumers cannot resolve (`src/types/entry.ts:1`, `src/types/head.ts:2`). Generate declarations from the runtime entry point and add a clean consumer compile test.

### [Medium] CI does not lint or type-check the safety net itself

`lint` targets only `src`, and the TypeScript project includes only `src` (`package.json:27`, `tsconfig.json:28-29`). Tests, helpers, stubs, and `vitest.config.ts` can drift or contain type errors while CI passes. Add dedicated lint/type-check coverage for them.

### [Medium] Dependency pruning is incomplete

At least `@types/inquirer`, `@helia/interface`, and `vite-tsconfig-paths` remain declared without repository imports (`package.json:48`, `package.json:52`, `package.json:69`); the Vitest config implements aliases manually and never loads the plugin (`vitest.config.ts:1-16`). Re-run pruning against production, tooling, examples, and docs separately rather than treating the current list as complete.

### [Low] Workflow hardening is minimal

Action tags are mutable and token permissions are implicit (`.github/workflows/ci.yml:18-29`). Pin actions by commit SHA and set `permissions: contents: read`. Add concurrency cancellation for superseded PR runs. These are hardening/resource concerns, not causes of the current failures.

## Verification performed

- `pnpm lint`: exit 0 with two existing TSDoc warnings in `src/functions/entry.ts:72`.
- `pnpm exec tsc --noEmit`: exit 0, but only `src` is included.
- `pnpm test`: 7 files passed; 45 tests passed and 4 expected failures.
- Focused `database.test.ts` iterator run: failed in isolation, confirming order dependence.
- `pnpm build`: exit 0.
- Import of built `dist/functions/index.js`: failed with `ERR_MODULE_NOT_FOUND`.
- Direct import of `helia` under the repository install: failed because the skipped `node-datachannel` binary is absent.

## Summary

Phase 0 added useful scaffolding, but it is not yet a reliable safety net: the happy-path tests pass while the normal runtime and built package fail smoke imports, and the replication path trusts unsigned leaf metadata, accepts foreign-database heads, races unawaited Pollard work, and detaches queue/publish errors. Reorder correctness before runtime-major upgrades (with tooling upgrades allowed independently), bind and authenticate all incoming state before mutation, move manifest-CID topics into that work, put access control before delete, and add packed-package plus adversarial multi-node tests before treating the roadmap's upgrade or v2 phases as de-risked.
