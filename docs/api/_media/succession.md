# Spec (draft): database succession — bounded growth without losing provenance

Status: **draft for discussion** (November 2026). Nothing here is implemented.
Origin: the idea to end a database with a signed hand-over to a fresh successor
that carries only what is still live.

## 1. The problem

A DenkMitDB database only grows:

1. **Tombstones are forever.** A delete is a signed tombstone that stays in the
   Merkle tree. It cannot simply be dropped: a peer that still holds the deleted
   put would re-announce it, and every replica would accept it again
   (last-write-wins sees nothing newer). The tombstone is what keeps a delete
   deleted.
2. **Superseded entries stay pinned.** When a newer record wins a key, the old
   record leaves the index and the tree, but its block stays pinned on disk.
3. **Old heads and pollards accumulate** in the blockstore.

Long-lived agent memory with steady churn therefore grows without bound, and the
tombstone set grows with every delete ever made.

What cannot be achieved in an open P2P system, by any design: forcing another
peer to erase data it already holds. A content-addressed, signed record that was
shared stays wherever it was copied. Succession is about **space and tombstone
reclamation on honest replicas**, not about erasure. (Confidential data needs
encryption — ROADMAP "encrypted values" — so that dropping a key is the
deletion.)

## 2. Layer A — local garbage collection (no protocol change)

Each replica owns its disk. Without any wire change a replica may:

- unpin the block of every entry that is no longer the live record for its key
  (`SortedItemsStore` already learns `previousCid` when a record is superseded);
- unpin heads other than the latest persisted one, and pollards no longer
  reachable from it.

Effects: problems 2 and 3 disappear locally; peers that still hold an old head
may fail to fetch superseded blocks from this replica, which only affects
history nobody's current tree references. Problem 1 (tombstones) remains — that
is what layer B is for.

This layer is safe to ship first, behind an option, with tests that a GC'd
replica still converges with an un-GC'd one.

## 3. Layer B — succession

A database M1 ends with a signed **succession record** naming a successor
database M2. M2 starts with exactly the records that were live in M1 at a named
head — no tombstones, no superseded entries — and every carried record keeps its
**original signature and author**.

### 3.1 The successor manifest

`MANIFEST_VERSION` 3 adds two optional fields:

```
predecessor:      CID   // M1's manifest CID
predecessorHead:  CID   // the signed head of M1 whose live state M2 inherits
```

plus the usual name, order and policies. Succession is also the natural place
to **change the rules**: M2 may carry a different access policy (e.g. a revised
allowlist). That gives a coarse, explicit form of revocation and onboarding long
before fine-grained delegation exists.

### 3.2 The succession record

A signed entry in M1 under a reserved key, e.g. `_denkmit/successor`, with value
`{ successor: CID(M2), head: CID(H) }`. It replicates like any entry.

Who may write it is decided by a new manifest policy, `succession`, evaluated
like the others (deterministic inputs only). Default for new databases:
**creator only**. Databases without a `succession` policy (manifest v1/v2) cannot
be succeeded. Open question §5.1 covers multi-party authority.

### 3.3 Carrying live state without re-signing

The successor must not re-sign other parties' facts — provenance would collapse
onto whoever compacted. Instead:

- M2's ingest rule accepts an entry if it is bound to M2 (as today), **or** if it
  is bound to M1 and is a **live record of tree(H)**: the last-write-wins winner
  for its key, and not a tombstone.
- `live(tree(H))` is a pure function of the signed head H, so every replica
  computes the same carry set. A replica joining M2 fetches H's tree once
  (under the same walk budget as `load()`), derives the set, and indexes it.
- Carried entries were already admitted under M1's policies; they are not
  re-judged by M2's policies (otherwise changing rules would silently delete
  history). M2's policies govern new writes only.
- Generalisation: over generations M3 accepts entries bound to M1, M2 or M3 that
  are live in its inherited head. Verifying the chain means walking
  `predecessor` links — a handful of manifests.

### 3.4 Migration

A node that ingests a valid succession record in M1:

1. opens M2 (the manifest arrives over bitswap like any database),
2. derives and indexes the carry set, subscribes to M2's topic, announces,
3. reports the move (MCP: `memory_status` shows the successor; the daemon
   remembers the new address),
4. keeps M1 open read-only for a grace period, then may drop it (layer A).

Writes made to M1 *after* H are not carried. A writer that sees the succession
re-writes them into M2 (the MCP layer can do this automatically for its own
identity's records).

### 3.5 Reclaiming space

Once on M2, a replica keeps pinned only M2's tree and the carried entries (still
M1-bound blocks, referenced from M2's tree), and may unpin everything else of M1:
tombstones, superseded entries, old pollards and heads. The tombstone set
restarts empty.

Resurrection is impossible by construction, which is where the November entry
binding (KNOWN_ISSUES.md #24) pays off: a stale peer replaying a deleted M1 put
into M2 is rejected — it is bound to M1 but not live in H.

## 4. Prior art

- **Willow** prunes on write: a newer entry at a path destroys older entries at
  that path or below it, so stores keep only current state.
- **AT Protocol** repositories hold current state only; history lives in the
  event stream (firehose), not in the repo.
- **Git** reclaims space with `gc` and can cut history with a new root (squash,
  shallow clones) — at the price of new commit identities. Succession keeps the
  original signed records instead.
- **Log compaction** (Kafka and similar) keeps the latest record per key and
  drops tombstones after a retention window — the same trade-off, with a central
  log instead of a signed hand-over.

## 5. Open questions (to settle before any code)

1. **Authority and forks.** Two authorized parties may declare different
   successors concurrently. Last-write-wins on the succession record converges
   every replica on one successor, but the losing successor's writes are
   orphaned. Options: creator-only (simple, centralised trust); k-of-n co-signed
   succession records (needs a co-signature format); successors that must
   reference the previous successor record (a chain, detectable forks).
2. **Choosing H.** Any head is valid input, but a head that misses recent writes
   drops them. Should the record require a quiet period, or should the successor
   also accept M1 entries newer than H for a grace window (re-opening
   unboundedness)?
3. **Retention of deletes.** A tombstone written just before succession is
   simply not carried. A peer offline since before the delete can still hold the
   old put; it is rejected in M2 (good) but still readable in M1 on that peer.
   Is that acceptable for agent memory? (It is the honest limit from §1.)
4. **Policy for carried writers.** If M2 drops a writer from its allowlist, that
   writer's carried facts remain readable but it can write nothing new — the
   intended "revocation" semantics. Confirm.
5. **MCP surface.** Automatic migration vs. an explicit tool
   (`memory_succeed`); how agents learn the new address; what `memory_list`
   shows during migration.

## 6. Suggested phasing

1. Layer A (local GC), opt-in, with convergence tests. Measures how much of the
   growth problem is local.
2. Manifest v3 + succession record + carry rule, creator-only authority, no
   automatic migration — exercised from tests and a CLI.
3. Daemon/MCP migration and the authority model from §5.1.
