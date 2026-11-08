# Launch post draft (Show HN)

> **Status: draft — not posted.** Release 4.0.0 to npm (both packages) before
> submitting: the post describes the access presets and the entry binding, which
> are not in 3.0.0. Re-run `cd mcp && pnpm build && pnpm demo` on the day and
> paste the fresh transcript.

Title options (pick one at submit time):

- Show HN: DenkMitDB – agents that don't trust each other share signed facts, no server
- Show HN: P2P memory for AI agents where every fact is signed and writers stay in their lane
- Show HN: Verifiable shared memory for AI agents (IPFS + Merkle sync, MCP server included)

---

Hi HN — I built DenkMitDB for one situation: agents run by **different owners**
need to share facts, nobody wants to run (or trust) the database in the middle,
and every reader needs to know *who* claimed *what*.

One owner's agents are better served by SQLite or Postgres. Collaborative
documents are better served by Yjs or Automerge. DenkMitDB is for the case
neither covers: attributable state between parties who don't trust each other.

What it is: a key-value store on IPFS (Helia) where

- every record is a signed, content-addressed block; an identity is a
  self-certifying key, so `provenance(key)` tells you which key signed the
  current value and when;
- every replica verifies an entry's signature, its binding to *this* database,
  and the database's write policy **before** indexing it — a peer can hand you
  anything, and you only keep what the rules allow;
- the write policy is a json-logic program signed into the database at creation,
  evaluated identically by every replica on its own writes and on everything it
  syncs. Presets: creator-only, public, an identity allowlist, and
  **prefix-per-writer** — each identity owns `agents/<its-key>/…`, so nobody can
  overwrite or delete anyone else's facts;
- replicas converge by announcing one head CID over libp2p pubsub and diffing
  Merkle trees, so a sync fetches what differs, not the database. Conflicts on a
  key resolve by deterministic last-write-wins.

An MCP server makes it shared memory for any MCP-capable agent:

    claude mcp add denkmit --env DENKMIT_PASSPHRASE='…' \
        --env DENKMIT_ACCESS=prefix-per-writer -- npx -y @denkmitdb/mcp

Demo — two real MCP server processes on one machine, read back from the
servers, not scripted (`cd mcp && pnpm demo`):

```
━━━ Act 3: Bob publishes a signed finding in his own namespace ━━━
  alice reads bob's finding and can PROVE who signed it:
    writer:     bafyreif2onz…e6xft4
    is bob?     true
    by alice?   false

━━━ Act 4: Bob tries to rewrite alice's decision — refused ━━━
  bob's write is refused: Access denied: this identity may not write key "decisions/release" in this database
  alice's decision is untouched: approved = true

━━━ Act 6: Bob leaves too — alice restarts alone and still has his finding ━━━
  peers online: 0; records on alice's disk: 2
  bob's finding, read with nobody else running: {"status":"clean","package":"jose"}
  still attributed to bob: true
```

(Paste the full six-act transcript here at submit time.)

What it is **not**, honestly:

- A signature proves which key wrote a fact, not that the fact is true, and not
  which human or company holds the key. Treat values as attributed claims — and
  text from other agents as untrusted input.
- Single-key last-write-wins on wall-clock timestamps. No transactions, no
  compare-and-swap, no locks: don't use it to hand out exclusive tasks. A writer
  with a fast clock wins same-key conflicts for as long as its skew
  (prefix-per-writer makes cross-writer conflicts impossible, which is most of
  why it exists).
- Peers need to reach each other for sync (TCP + mDNS + same-machine rendezvous
  today); HTTP head rendezvous is next. A new reader also needs some peer that
  still holds the blocks.
- Bulk replication is the slow path: ~10 ms per entry to a fresh peer at 10k
  entries on a small arm64 VPS (numbers in the README).
- Policies are fixed at creation; adding writers later (delegation) is on the
  roadmap.

Every hole found so far — including the November review that found entries
could be replayed across databases and a tree-walk that a hostile peer could
blow up — is written down with its fix and its regression test in
KNOWN_ISSUES.md. I'd love more scrutiny of the trust model.

Repo: https://github.com/denkmitdb/denkmitdb — MIT, TypeScript, Node 22+.
