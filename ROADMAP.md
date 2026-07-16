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

## Phase 1 — Specify, then pin (before touching behavior)

Decisions that freeze the wire format, plus tests that lock in what "correct"
means, so later phases have a target:

1. **Ordering format decision (D3, #3):** composite sort key `[timestamp, entryCID]`
   as a deterministic total order; decide now whether wall-clock or HLC timestamps
   determine LWW winners. Version the leaf/pollard format and specify how old
   blocks/peers are rejected or migrated — "publish 2.0.0" is not a plan.
2. **Adversarial test pins** (all `it.fails` today): forged leaf metadata must be
   rejected (#10), foreign/malformed heads must be rejected (#11), `SortedEntry`
   diff must see metadata changes (#12), merge conflict + reverse delivery + two
   databases on one node (#4/D5), stale-cache-after-merge (#1), falsy values (#18).

## Phase 2 — Correctness on the current stack

In dependency order:

1. **Authenticate replicated state (#10, #11):** fetch + verify signed entries at
   merge time, require leaf metadata to match the signed entry, bind heads to the
   manifest. The trust model in ARCHITECTURE.md becomes true here.
2. **Index integrity (#2, #3, #12):** composite key from Phase 1, true
   timestamp-LWW with CID tie-break, removal of superseded records (rebuild from
   `min(old, new)`, truncate shrunk suffixes), full-metadata leaf equality.
3. **Async discipline (#13, #14, #15, #5):** await pollard appends, propagate
   queue/publish/callback promises, awaited `setupSync`, guard empty merges.
4. **Cache & API correctness (#1, #16, #17, #18, #19):** invalidate on merge (only
   when the incoming record wins), honest `createHead` on empty, replacement `load`,
   falsy-value handling, honour or remove the ignored options.
5. **Lifecycle (#9) + smaller defects (#6, #7, #8, #20).**
6. Flip each `it.fails` pin as its fix lands.

Tooling-only upgrades (TypeScript, eslint, typedoc, prettier) can happen at any
convenient point — they don't change runtime behavior.

## Phase 3 — Runtime upgrades, bundled with their adjacent fixes

| Bundle | Packages | Paired work |
|---|---|---|
| 3.1 | helia 4→7, libp2p 1→3, gossipsub 13→14, @libp2p/*, multiformats 13→14 | Topic = manifest CID (D5), listener/teardown rework (#4/#9 remnants), removes the node-datachannel consumer exposure. `connectionEncryption` → `connectionEncrypters`, service typings, logger API. |
| 3.2 | jose 5→6 | `KeyLike` removal forces reworking `identity.ts` key typing — pair with the detached-payload decision (#6) and V1/V2 consolidation. |
| 3.3 | keyv 4→5, p-queue 8→9, uint8arrays 5→6 | Keyv ownership semantics from D4. |

Exit criteria: `pnpm outdated` clean, CI green including the packaging smoke test,
adversarial integration tests pass, consumer install works on modern Node without
the stub override.

## Phase 4 — Features & v2.0.0

Strictly in this order (each depends on the previous being real):

1. **Access control (D1):** implement the manifest `access` controller (start with
   creator-only / ACL json-logic over `entryCreator`), enforced in `set` **and** the
   now-authenticated merge/load paths. Rename "consensus" to write-validation
   policy, or specify actual coordination (D2).
2. **Delete (D7):** tombstone leaf/entry type — only safe once writes are
   authenticated (#10) and authorized (D1), otherwise any peer can delete anything.
3. **Persistence (D4):** persist index/head locally; `openDenkmitDatabase` loads the
   last local head; defined Keyv ownership semantics. Identity cache (D6).
4. **Release:** rename `polllard/` → `pollard/` and remaining typos, benchmarks
   (write throughput, sync latency vs. diff size), typedoc regeneration, publish
   **2.0.0** with the Phase 1 wire-format version gate.

## Deliberately out of scope for v2

- Browser transports (webrtc/websockets) — revisit after v2 on the upgraded stack.
- Multi-database transactions; indexes/queries beyond key lookup and ordered
  iteration.
- Byzantine-fault-tolerant consensus — D2 documents the honest scope: per-node
  write validation, not agreement.
