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

## Positioning vs. CRDTs

Formally, DenkMitDB **is** a CRDT — a state-based LWW-map with a deterministic
merge function (composite key: timestamp + entry-CID tie-break; commutative,
associative, idempotent — `specs/ordering.md` proves the convergence
properties a CRDT paper would ask for). So the frame is not "DenkMitDB vs.
CRDTs"; it is *which species*. Use their vocabulary: **an authenticated
LWW-map CRDT for untrusted networks.**

Concede fast what Automerge/Yjs win: fine-grained concurrent editing — text,
JSON trees, offline edits interleaving without loss, a mature ecosystem. If
the problem is collaborative editing, Yjs wins; our own docs should say so.
(This is also why the out-of-scope list below bans rich merge types.)

Where they are structurally weak — and it is this project's entire
architecture:

1. **Byzantine peers break them.** Automerge/Yjs assume honest replicas: ops
   are unsigned, so any peer can forge operations as anyone. (Retrofitting
   auth — Ink & Switch's Keyhive line — is research-stage.) DenkMitDB
   verifies every entry's signature *before indexing* and enforces
   manifest-bound ACLs on the merge path; it can accept data from strangers.
2. **No provenance.** A merged CRDT doc is an undifferentiated soup;
   attribution is forgeable metadata. `provenance()` is a cryptographic
   answer.
3. **Full-state replication.** A CRDT replica holds the whole document plus
   history (Automerge docs grow without bound; tombstone GC is an open sore).
   DenkMitDB is content-addressed: sync cost scales with the Merkle diff, and
   a replica can hold the index and fetch values lazily. (Honesty: our blocks
   accumulate too — that is the tombstone-GC roadmap item.)
4. **Closed-group design.** CRDTs sync among a known set of trusted replicas,
   usually via a relay server. DenkMitDB is built for open networks with
   per-write authorization.

**The positioning sentence:** *CRDTs solve concurrent editing among trusted
peers; DenkMitDB solves attributable state among untrusted peers.* For the
agent-memory wedge, the trust axis is the one that matters.

**The judo move — carry them, don't fight them.** A value is just dag-cbor
bytes, so a value can *be* a CRDT document: store an Automerge doc (or update
batches) under a key; DenkMitDB gives it signed, serverless, P2P replication
and provenance; Automerge gives that key rich merge semantics. Today
`automerge-repo` needs a sync server — DenkMitDB can be the *authenticated,
serverless sync substrate for CRDTs*. Cheap to prototype: one example and a
doc page, no core changes (a merge-hook API later only if it earns it).

**LWW's honest cost, and its mitigations (already on the roadmap under other
names):** concurrent writes to one key lose one side. Per-writer namespace
ACLs structurally eliminate most same-key races; HLC upgrades "fast clock
wins" to causally-plausible ordering; a future `history(key)` (superseded
records are still in the block store, signed) turns "LWW lost data" into
"LWW chose a winner, losers auditable" — a story no CRDT can tell, because
their losers merge into anonymity.

## The third axis: policy — the database carries its own constitution

Every manifest embeds two json-logic programs — validation and access —
**signed, content-addressed, and evaluated identically by every replica at
ingest**. That combination is rare:

- **CRDTs have nothing here.** No concept of "this document rejects your op";
  admission control means putting a server in front, which reintroduces the
  server.
- **Blockchains have custom logic** only by paying for global ordering:
  consensus rounds, gas, a halting-problem workaround. DenkMitDB gets
  programmable admission *for free* because it never needs agreement —
  acceptance is a pure function of `(manifest, signed entry)`, so every
  honest replica computes the same verdict independently.
- json-logic's weakness — no loops, no recursion — is here a feature:
  **policies are total functions.** They always terminate, so there is no gas
  metering and no adversarial policy that can wedge a replica.

The positioning trilogy: **authenticity** (signed entries), **attribution**
(provenance), **admission** (replicated programmable policy). CRDTs have none
of the three; centralized memory services have them only by fiat of the
server.

Expressible **today**, zero changes, just undocumented: an identity allowlist
— `{"in": [{"var": "entryCreator"}, ["<cid1>", "<cid2>"]]}` — i.e. "shared
memory for exactly these N agents."

**Honest audit before selling it** (feeds the sequence below):

1. **The policy cannot see the key or value yet.** The check inputs are
   creator/timestamp fields only — so per-writer prefix ownership is not
   expressible until `entryKey` (and value byte-size) join the input surface.
   Small change, outsized payoff: prefix ACLs, key-schema enforcement, and
   size caps all become pure json-logic.
2. **Two inputs are convergence footguns.** `currentTimestamp` and
   `currentIdentity` are node-local; the built-in policies avoid them by the
   D3 discipline, but a *custom* policy has no guardrail — one comparison
   against `currentTimestamp` and replicas silently diverge on what they
   accept. Remove node-local fields from the replicated-policy input (or
   split them into an explicitly local-only admission hook) before
   advertising custom policies.
3. **Policies are immutable** — manifest-bound at creation. A feature
   (rules are content-addressed and can never change silently) and a
   governance gap (no adding writers later). Delegation entries resolve it
   without breaking the model: the policy stays immutable but says "or the
   entry creator holds a grant signed by the database creator."

Plus a cheap, high-leverage deliverable: a **policy cookbook** (creator-only,
public, allowlist, prefix-per-writer, key-schema) — presets are how users
actually consume a policy engine.

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
6. Policy input hardening (+`entryKey`, drop node-local fields) — then
   namespace ACLs land as a preset policy, with the policy cookbook.
7. HTTP head-rendezvous.
8. Encrypted values.

Each step after (3) is independently shippable.

---

The engineering discipline in this repo is above what the "distributed database"
market rewards, and exactly what the agent-trust market lacks. Point it there.
