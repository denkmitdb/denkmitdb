# Spec: Entry ordering, conflict resolution, and format versioning (v2)

Status: **accepted** (July 2026, ROADMAP.md Phase 1). This freezes the decisions
that KNOWN_ISSUES.md #2/#3/D3 and the adversarial review said must precede the
Phase 2 correctness work. Implementation lands in Phase 2; the adversarial test
pins in `test/` encode this spec today.

## 1. The problem

v1 orders entries by `Date.now()` milliseconds alone:

- Two entries in the same millisecond collide in the index — one is lost (#3).
- Per-key conflict resolution is merge-order-dependent, so replicas that learn
  the same entries in different orders permanently disagree (#2).
- "Same entry set ⇒ same Merkle root" — the property head comparison relies on —
  therefore does not actually hold.

## 2. Decision: composite sort key

The canonical sort key of an entry is the pair:

```
sortKey(entry) = (timestamp, entryCID)
```

- `timestamp` — the entry's signed creation time, integer milliseconds since the
  Unix epoch (as today; see §4 for trust semantics).
- `entryCID` — the CIDv1 of the signed entry block, compared as its raw
  **byte string** (multibase-independent, lexicographic, shorter-is-smaller —
  in practice CIDv1/sha2-256 byte strings have equal length).

Comparison is lexicographic on the pair: timestamp first, CID bytes as the
tie-break. Because CIDs are collision-resistant content hashes, `sortKey` is a
**deterministic total order** over all distinct entries: no coordination, no
counters, no equal keys.

Consequences:

- The ordered index (`SortedItemsStore`) is keyed by the composite key. Two
  different keys written in the same millisecond both survive.
- Layer-0 pollard leaves are appended in composite-key order, so any two
  replicas holding the same entry set build byte-identical pollards and
  converge on the same root, independent of merge order.

## 3. Decision: per-key conflict resolution (LWW)

For a database key `k`, the winning entry is the one with the **greatest
composite sort key** among all known entries for `k`:

```
winner(k) = max_{e : e.key = k} (e.timestamp, e.cid)
```

- Newest timestamp wins; equal-timestamp conflicts fall back to the larger CID
  bytes — arbitrary but deterministic and verifiable by every replica.
- Merging an entry that loses to the currently-indexed entry for the same key
  is a **no-op for the key map** (the loser is not indexed, its value is not
  cached). The stale-read invalidation of #1 applies only when the incoming
  entry wins.
- When a new entry for `k` wins, the superseded entry's record is **removed**
  from the ordered index (and its pollard range rebuilt from
  `min(oldSortKey, newSortKey)`), so exactly one live record per key exists in
  the tree. `size` equals the number of live keys.

Deletes (Phase 4 tombstones) will follow the same rule: a tombstone is an entry
whose winner status hides the key; it participates in ordering identically.

## 4. Decision: wall-clock timestamps, validated — HLC deferred

The `timestamp` remains **wall-clock milliseconds** in v2, not a hybrid logical
clock:

- The composite key already provides a deterministic total order; HLC would only
  improve *causality fidelity* of the winner choice, not determinism.
- HLC state (logical counters) would have to live in the signed entry format;
  introducing it later is a compatible change (a new entry version whose
  timestamp is an HLC tuple mapped into the same composite-key comparison), so
  deferring does not paint us into a corner.
- What we lose until then: a writer with a fast clock wins conflicts for as long
  as its skew. This is the documented v2 trade-off (KNOWN_ISSUES.md D3).

Mitigation required in v2 (enforced at merge time, not only at write time): the
default write-validation rule must reject entries whose timestamp is further
than `MAX_CLOCK_SKEW` (default: **60 000 ms**) ahead of the local clock. Entries
arbitrarily far in the past are accepted (they lose conflicts naturally).

## 5. Decision: format versioning and rejection

The ordering change alters how trees are built from the same entries, so v1 and
v2 replicas of the same database would compute different roots — they must not
silently interoperate.

- `POLLARD_VERSION` and `HEAD_VERSION` are bumped `1 → 2`. `ENTRY_VERSION`
  stays `1` (the entry format itself is unchanged).
- A v2 node **rejects** heads and pollards whose `version ≠ 2` — the diff/merge
  path treats them like malformed input: log, drop, no state change. (v1 nodes
  ignore versions entirely; nothing can be done for them retroactively — which
  is exactly why versions must be checked from v2 on.)
- Version checks happen alongside the manifest-binding check of #11: a head is
  processed only if `head.manifest == our manifest CID` **and**
  `head.version == HEAD_VERSION`, and each fetched pollard only if
  `pollard.version == POLLARD_VERSION`.
- **No migration tooling for v1 data.** v1 was never usable as a published
  package (see CHANGELOG), so there is no deployed data to migrate. A database
  created by a v1 build must be re-created (re-set its entries) under v2.

## 6. Wire/type changes (Phase 2 implementation checklist)

- `SortedItemType.sortField: number` → composite key; `SortedItemsStore` keyed
  and iterated by `(timestamp, cidBytes)`.
- `LeafType` (`SortedEntry`): `sort` stays `number[]` carrying `[timestamp]`;
  the CID tie-break uses the existing `link` field — **no leaf shape change**,
  only ordering/equality semantics (and #12: equality must compare all fields).
- `POLLARD_VERSION = 2`, `HEAD_VERSION = 2`, plus version guards in
  `fetchHead`/`getPollard`/merge/load.
- Default consensus rule gains the future-timestamp bound of §4.

## 7. Invariants (what the adversarial pins assert)

1. Same entry set ⇒ same root, regardless of delivery order or timestamp
   collisions.
2. At most one live record per key in index and tree; `size` = live keys.
3. `winner(k)` is identical on every replica given the same entry set.
4. Heads/pollards from other databases or other format versions never mutate
   local state.
5. Index metadata that disagrees with its signed entry never enters the index
   (KNOWN_ISSUES.md #10 — authenticated merge).
