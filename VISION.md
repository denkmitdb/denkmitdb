# Vision — where DenkMitDB goes after v2

*Written 2026-08-29. This is the strategic frame for post-v2 work; the mechanics
live in [ROADMAP.md](ROADMAP.md) ("Post-v2"), open items in
[KNOWN_ISSUES.md](KNOWN_ISSUES.md).*

## The wedge: agent memory, not "a database"

As a general-purpose distributed database, DenkMitDB competes with OrbitDB (same
stack, larger community, mostly stagnant), with CRDT libraries (Automerge/Yjs,
which won local-first mindshare), and ultimately with "just use Postgres." That
lane is crowded and adoption-hostile; a solo-maintained P2P KV store does not win
it on database merits.

But the agent-memory space (mem0, Zep, Letta, OpenMemory) is all *centralized
services with API keys*, and none of them can answer the question that becomes
critical the moment agents from different owners collaborate: **"who wrote this
fact, and can I prove it?"** DenkMitDB's core primitives — signed entries,
self-certifying identities, per-record provenance, deterministic conflict
resolution, no server — are exactly the missing trust layer. That is not a
feature gap a centralized competitor fills; it is a structural difference.

**So the framing inverts: `denkmit-mcp` is the product; DenkMitDB is its
engine.** Not "a database that happens to have an MCP server" but *verifiable
shared memory for AI agents — no server, no vendor, cryptographic provenance —
built on a Merkle-synced P2P store.*

Every post-v2 decision gets tested against that wedge.

## What the wedge implies (priority order)

### 1. Credibility at scale

The v2.0.0 three-layer rebuild hang (KNOWN_ISSUES.md #22) existed because
nothing ever tested past one pollard. For a *memory* product, capacity is a
headline claim: a benchmark/soak script (≥10k keys, N concurrent writers,
reopen-time measurement) with the numbers published in the README. This also
flushes out the next class of walls before a user hits them — the likely
candidates being the O(n) full-tree rebuild on every early-timestamp merge, and
the in-memory `SortedItemsStore` + full tree replay on reopen (which is why the
persisted materialized index matters more than it looks).

### 2. Publish to npm

`npx @denkmitdb/mcp` in a `claude mcp add` one-liner is most of the growth
story; nothing else matters until install is zero-friction. The
helia-7/`DenkmitHeliaInterface` break happens **before** first publish — it is
cheap now and a major-version event afterwards.

### 3. The killer demo

One recording: two agent sessions on different machines, no shared server; one
writes `task/42/status`, the other reads it and `memory_provenance` shows
*cryptographically whose claim it is*; kill one node, the other still has
everything. That demo is the launch post.

### 4. Namespace ACLs — the feature that makes multi-agent real

Creator-only vs. world-writable is too coarse for the actual use case. The
natural model: each agent owns its key prefix (`agents/<identity-cid>/…`
writable only by that identity), enforced by the existing policy engine
(json-logic over deterministic inputs — the D1/D3 discipline: acceptance must be
a pure function of manifest + signed-entry data). "Shared memory between agents
that don't fully trust each other" becomes safe by construction. Dynamic grants
(creator signs a delegation entry) come later; prefix ownership alone is the big
unlock.

### 5. Durable head discovery, reframed (D8)

Full IPNS is an under-specified network project (see PHASE_PRIORITIES.md). The
80% for the agent wedge is much cheaper: a dumb **HTTP head-rendezvous** — any
URL an agent can GET/PUT a signed head CID to (a gist, an S3 object, a tiny
worker). Heads are already signed and validated on ingest, so the rendezvous
needs zero trust: its boundary is availability/freshness only, exactly the trust
analysis already written for delegated routing. This gives cross-NAT,
cross-cloud sync without touching IPNS's Ed25519-vs-ES384 mismatch. The
`addrs.json` file rendezvous in `mcp/` is already this pattern locally;
generalize it. It also delivers the "pluggable head discovery" that loosens the
libp2p-pubsub coupling (helia-7 / HTTP-only nodes).

### 6. Private memory — the primitive already exists

`Identity.encrypt`/`decrypt` (ECDH-ES JWE) is built, tested, and unused by the
product. Per-value encryption to a recipient identity gives *shared memory where
peers replicate facts they cannot read* — verifiable **and** confidential P2P
agent memory, a combination that exists nowhere. Small feature, existing code.

## What we deliberately do not build

- **Semantic/vector search.** The loudest request and the wrong one: it drags in
  embeddings, model choices, and an eval burden orthogonal to the
  differentiation. The agent does retrieval; DenkMitDB does trust and sync.
  Prefix listing + provenance filters are enough structure.
- **BFT consensus, browser transports, query engines.** The v2 out-of-scope list
  stands (see ROADMAP.md).
- **A broader database identity.** Every hour spent making DenkMitDB "general
  purpose" competes with OrbitDB; every hour on the memory lane competes with
  nobody.

## Sequence

1. Land the #22/#23 fix (correctness first, always).
2. helia 7 + remaining medium findings (the interface break, pre-publish).
3. npm publish — both packages.
4. Benchmark numbers in the README.
5. Demo + launch post.
6. Namespace ACLs.
7. HTTP head-rendezvous.
8. Encrypted values.

Each step after (3) is independently shippable.

---

The engineering discipline in this repo is above what the "distributed database"
market rewards, and exactly what the agent-trust market lacks. Point it there.
