# Launch post draft (Show HN)

> **Status: draft — not posted.** Publish `@denkmitdb/denkmitdb` 4.0.0 and `@denkmitdb/node` 0.3.0 and `@denkmitdb/mcp` 0.3.0 to npm before
> submitting: the post describes the access presets and the entry binding, which
> are not in 3.0.0. Re-run `cd mcp && pnpm build && pnpm demo` on the day and
> paste the fresh transcript.

Title options (pick one at submit time):

- Show HN: DenkMitDB – a P2P database where every record is signed and every replica enforces the rules
- Show HN: DenkMitDB – signed, replicated state with no operator; first app: shared memory for AI agents
- Show HN: A peer-to-peer database for parties that share state but not a server (MCP agents included)

---

Hi HN — I built DenkMitDB, a peer-to-peer database for one situation: several
parties (services, devices, organizations, AI agents) need to share facts, nobody
wants to run (or trust) the database in the middle, and every reader needs to know
*who* claimed *what*.

One owner is better served by SQLite or Postgres. Collaborative documents are
better served by Yjs or Automerge. DenkMitDB is for the case neither covers:
attributable state between parties that don't share a server.

What it is: a key-value store on IPFS (Helia) where

- every record is a signed, content-addressed block; an identity is a
  self-certifying key, so `provenance(key)` tells you which key signed the
  current value and when;
- every replica verifies an entry's signature, its binding to *this* database,
  and the database's consensus rules **before** indexing it — a peer can hand you
  anything, and you only keep what the rules allow;
- the consensus rules — who may write (access) and which entries are valid
  (validity) — are small deterministic programs in a closed, versioned subset of
  JsonLogic, signed into the database at creation and evaluated identically by
  every replica on its own writes and on everything it syncs. Presets:
  creator-only, public, an identity allowlist, and
  **namespace-per-writer** — every identity, the creator included, owns exactly
  `agents/<its-key>/…`, so nobody can overwrite or delete anyone else's facts
  (custom rules can also tell puts from deletes);
- values can be **encrypted** to chosen identities and still replicate as signed
  records; peers relay ciphertext they cannot read;
- replicas converge by announcing one head CID over libp2p pubsub and diffing
  Merkle trees, so a sync fetches what differs, not the database. Conflicts on a
  key resolve by deterministic last-write-wins.

It comes as three packages: the library; `denkmitd`, a node that keeps a
machine a peer and holds its keys; and the first application, `denkmit-mcp`, which
turns it into shared memory for any MCP client (Claude Code, Codex, Claude
Desktop) over stdio. Each agent can sign with its own identity:

    npm install -g @denkmitdb/node @denkmitdb/mcp
    DENKMIT_PASSPHRASE='…' DENKMIT_ACCESS=namespace-per-writer denkmitd
    claude mcp add denkmit --env DENKMIT_DAEMON=require -- denkmit-mcp   # in a second terminal

Demo — two real MCP server processes on one machine, read back from the
servers, not scripted (`cd mcp && pnpm demo`; it uses `prefix-per-writer`, where
the creator acts as a trusted coordinator):

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

It runs today on four machines in four situations — a public server as the
seed, a second server, a home machine behind NAT, and a laptop behind a
corporate firewall that allows only HTTPS (the seed also speaks libp2p over
WebSockets on 443) — with Claude Code, Codex and Claude Desktop agents, each
signing with its own key. All four machines are mine, so "parties that don't
trust each other" is simulated so far; running it with someone else's machine is
the next test. Before launch I ran the same test plan through real
agent sessions on different machines, using only their memory tools; it found
three bugs the unit and smoke tests could not (agents losing their tools when
the daemon restarted, stale tool schemas after an upgrade, agents inventing
timestamps because the signed write time was not returned), all fixed. A script
now replays that cross-machine plan against the live nodes in one command.

What it is **not**, honestly:

- Not the only signed or peer-to-peer store. OrbitDB, Willow/Meadowcap, p2panda
  and Keyhive have signed or authorised entries with rules every replica applies,
  and some have stronger designs; x0x and Constellate are the closest on the agent
  side. I haven't found another MCP server that gives a private group a replicated
  store where each record carries its writer's signature and each copy enforces
  the group's own write rules — tell me what I missed.
- Not a memory product with search: the agent does retrieval. Memory servers such
  as basic-memory serve one owner's notes well and can sit beside it.
- A signature proves which key wrote a fact, not that the fact is true, and not
  which human or company holds the key. It doesn't protect against prompt
  injection either: treat values as attributed claims, and text from other agents
  as untrusted input.
- Single-key last-write-wins on wall-clock timestamps. No transactions, no
  compare-and-swap, no locks: don't use it to hand out exclusive tasks. A writer
  with a fast clock wins same-key conflicts for as long as its skew
  (namespace-per-writer makes cross-writer conflicts impossible, which is most
  of why it exists).
- Peers need to reach each other for sync: direct dial, mDNS on a LAN, or an
  always-on seed today (over TCP or, for HTTPS-only networks, WebSockets on 443);
  discovery by database address over a DHT and libp2p relays are next. A new
  reader also needs some peer that still holds the blocks.
- Reads are not access-controlled: anyone with the database address and a
  reachable peer can replicate it. Encrypt what must stay private — key names,
  writer, recipients and size stay public, and there's no forward secrecy or key
  rotation yet.
- A delete is a signed tombstone: it hides the record everywhere, but copies others
  already hold are not erased. Don't put other people's personal data in it.
- It works with clients that start a local MCP server over stdio. claude.ai on the
  web and mobile, and ChatGPT, accept only public HTTPS servers with OAuth; that
  isn't supported yet.
- Bulk replication is the slow path: ~10 ms per entry to a fresh peer at 10k
  entries on a small arm64 VPS (numbers in the README).
- Policies are fixed at creation; owner-signed delegation (so other parties see
  "Askar", not four machine keys) is specified and next on the roadmap.

Every hole found so far — including the November review that found entries
could be replayed across databases and a tree-walk that a hostile peer could
blow up — is written down with its fix and its regression test in
KNOWN_ISSUES.md. I'd love more scrutiny of the trust model.

Repo: https://github.com/denkmitdb/denkmitdb — MIT, TypeScript, Node 22+.
