# Remaining-phase priority assessment

Reviewed at `main` commit `92c2c51` on 2026-07-16. This assessment is based on the
current `ROADMAP.md`, `KNOWN_ISSUES.md`, implementation, and tests—not the earlier
review.

Effort estimates assume one engineer familiar with the repository:

- **S:** less than one day
- **M:** two to four days
- **L:** roughly one to two weeks
- **XL:** multiple weeks / separate project

Risk is implementation/protocol risk, not merely effort.

## Executive verdict

The remaining roadmap is directionally right that authorization must precede delete,
but its strict sequence is otherwise wrong. Persistence is more foundational than
delete and should move ahead of it. D5 should not wait for access control or IPNS. D6
is no longer a low-priority optimization because authenticated merge reconstructs and
re-verifies an identity for every foreign entry. D3 cannot safely be implemented as a
simple local-clock rejection inside the replicated policy. Full multi-writer IPNS plus
HTTP routing plus Helia 7 is an under-specified architecture project and should not
gate v2.0.0.

The single highest-value next milestone is an end-to-end **manifest-bound,
creator-only access-control vertical slice**, preceded by acceptance tests and the
D2/#19 API decisions. It turns the package from authenticated-but-world-writable into
something safe enough to use and unlocks tombstones. D5 and unchanged-head
re-announcement should be the first small commits inside that milestone.

## Where the current roadmap is mis-prioritized

### 1. D3 is a convergence problem, not just another json-logic rule

The accepted ordering spec requires rejection when an entry is more than 60 seconds
ahead of the receiver's local clock (`specs/ordering.md:68-85`), and the roadmap says
to add that bound with access control (`ROADMAP.md:84-88`). That is unsafe if
implemented as permanent rejection:

- `currentTimestamp` differs by node and by delivery time
  (`src/functions/denkmitdb.ts:404-413`).
- One replica can reject the same valid signed entry that another accepts.
- There is no deferred-entry/quarantine queue or retry-at-eligibility mechanism.
- The current unchanged-head announcement bug means the rejecting node may never see
  the head again (`src/functions/denkmitdb.ts:258-275`,
  `src/functions/denkmitdb.ts:642-649`).

More generally, replicated policy must not depend on `currentIdentity` or
`currentTimestamp`, because those are node-local inputs. Authorization should use
deterministic manifest data and authenticated entry data only. Local operational
admission (rate limits, clock warnings, temporary quarantine) is a separate layer.

**Recommendation:** do not ship the proposed 60-second rule as a permanent deny.
Either:

1. defer skew enforcement in v2 and document the fast-clock trade-off; or
2. implement a bounded quarantine with durable retry, explicit resource limits, and
   tests proving eventual convergence without a new write.

Option 1 is the lower-risk v2 choice. HLC can remain post-v2. Amend
`specs/ordering.md` before implementing D1 so the access-policy API does not encode a
non-deterministic acceptance rule.

### 2. D8 is understated, but full IPNS is over-scoped

The late-joiner problem is worse than `KNOWN_ISSUES.md:170-188` says. The code does
not re-broadcast an unchanged head every 30 seconds: `createOnlyNewHead()` returns
`undefined` when the root has not changed, and both the timer and public `sendHead()`
use that method (`src/functions/denkmitdb.ts:258-275`,
`src/functions/denkmitdb.ts:632-649`). A peer that joins after the one announcement
can remain empty until another write changes the root. The documented “next 30 s
re-broadcast” does not exist.

That availability bug deserves an immediate fix, but the proposed IPNS design is not
ready to implement:

- An IPNS name is derived from a public key, and whoever owns the corresponding
  private key controls that name. One manifest-scoped name therefore implies a single
  publisher/shared key; one name per writer requires a separate mechanism for readers
  to discover every writer's name. The current “resolve all” plan does not define that
  mechanism. See the [IPNS record specification](https://specs.ipfs.tech/ipns/ipns-record/).
- DenkMitDB identities default to ES384, while public IPNS interoperability mandates
  Ed25519 and treats ECDSA as optional. Reusing the existing identity key is not a
  safe assumption.
- IPNS records expire, DHT records are retained for at most roughly 48 hours, and
  publishers must republish them. Ownership of that lifecycle is absent from the
  roadmap. Sequence numbers choose the latest record for one IPNS name; they do not
  merge heads across unrelated writer names.
- The current `@helia/ipns` package line targets `@helia/interface` 7,
  `multiformats` 14, and datastore 10, so the latest implementation pulls directly on
  the Helia-7 cluster the project deliberately deferred. See the official
  [`@helia/ipns` package](https://github.com/ipfs/helia/blob/main/packages/ipns/package.json).
- The official Helia documentation warns that its IPNS pubsub router still requires
  frequent updates and listening peers; it is not itself the durable/offline answer.
  See [`@helia/ipns` routing documentation](https://github.com/ipfs/helia/tree/main/packages/ipns).

**Recommendation:** before v2, extract a small head-source/head-sink interface and
ship **local persisted head + corrected pubsub**. Defer network IPNS, HTTP delegated
routing, and Helia 7 to a separately specified post-v2 phase. An HTTP router need not
be trusted for record authenticity (IPNS signatures cover that), but it can still
withhold or replay stale valid records, so the trust statement in `ROADMAP.md:181-183`
should be narrowed to availability/freshness/privacy.

### 3. D6 is now a release concern, not a later optimization

Every foreign JWS calls `fetchIdentity()` unless it was signed by the local identity
(`src/functions/utils/helia.ts:228-243`). `fetchIdentity()` gets the identity block,
verifies the identity's self-signature, decodes it, constructs a new `Identity`, and
then entry verification imports/uses its public key (`src/functions/identity.ts:246-254`).
Merge and load do this serially for every differing entry
(`src/functions/denkmitdb.ts:323-329`, `src/functions/denkmitdb.ts:575-584`). The
blockstore may make repeated gets local, but repeated DAG decoding, identity
verification, object creation, and key import remain. The 53-test suite uses tiny
datasets and does not measure this path.

This is also a DoS multiplier: an attacker can advertise many entries or many unique
identity CIDs and make a receiver perform network/crypto work before rejection.
Access control helps: for creator-only/ACL databases, parse the protected `kid` and
cheaply reject a non-member before fetching that identity, then verify before final
acceptance. It does not remove the need for caching allowed writers.

**Recommendation:** before v2 add a bounded CID-keyed LRU of successfully verified
identities, in-flight promise coalescing, short/limited negative caching, fetch
concurrency limits, and a merge benchmark. Do not add an unbounded map; that merely
turns network/crypto pressure into memory pressure.

### 4. D4 should precede D7

Current order is access → delete → persistence (`ROADMAP.md:152-160`). A database
that cannot reopen its own last head without a live peer has a more fundamental
usability/durability defect than a database lacking delete. Persistence also provides
the restart test bed tombstones need.

Do not begin by persisting a second full index representation. The minimal durable
slice is:

- persist the last locally built/accepted head CID under a manifest-CID namespace;
- on open, fetch it, revalidate manifest/version/signature, and rebuild from it;
- update the pointer only after the new tree/head is complete;
- ensure all referenced blocks needed after restart are pinned, including foreign
  entries/identities fetched during merge (JWS payloads do not automatically create
  traversable IPLD links from a pinned head);
- distinguish an internally owned cache from a caller-supplied Keyv, namespace keys
  by manifest, and never unconditionally clear caller-owned persistent storage
  (`src/functions/denkmitdb.ts:229-234`, `src/functions/denkmitdb.ts:138-147`).

Persisting a materialized index can follow later as a startup optimization. The head
is the source of truth.

### 5. D5 should ship now

Manifest binding prevents state contamination, but same-name databases still receive
and fetch irrelevant announcements (`KNOWN_ISSUES.md:157-160`). With floodsub, avoiding
needless fan-out matters more, not less. Both create and open already have the manifest
CID before constructing sync (`src/functions/denkmitdb.ts:62-73`,
`src/functions/denkmitdb.ts:97-105`), so using a versioned topic such as
`/denkmitdb/2/<manifest-cid>` is a small, low-risk change.

Do this with the unchanged-head re-announcement fix and add a late-joiner test plus a
same-name/different-manifest isolation test. There is no justification for waiting
until IPNS or Helia 7.

### 6. D2 and #19 are protocol/API decisions, not cleanup

The current API exposes `order`, `sortedItemsStore`, `syncController`, and
`consensusController` (`src/types/denkmitdb.ts:130-138`). Creation honours only the
custom sync controller; it ignores `order`, `sortedItemsStore`, and
`consensusController`. Opening ignores all four options and uses manifest order plus
freshly fetched/constructed controllers (`src/functions/denkmitdb.ts:46-84`,
`src/functions/denkmitdb.ts:97-117`, `src/functions/denkmitdb.ts:138-147`).
`KNOWN_ISSUES.md:114-119` is incomplete because it does not mention the ignored
`syncController` on open.

Do **not** blindly “honour all options”:

- Honour `order` only when creating; opening must use the signed manifest value.
- Remove public `sortedItemsStore` injection unless implementations can be certified
  against all ordering/LWW invariants. It is protocol-critical state, not a casual
  adapter.
- Never allow an open-time local policy override. The manifest-bound policy is part
  of database identity; different local policies destroy convergence.
- Replace `syncController` injection with the narrower discovery strategy interface
  planned for D8.

D2 should land before the first real v2 publication because `ConsensusController` is
public and semantically false. Use explicit **validation policy** and **access policy**
names. Keep protocol-level policy deterministic. If manifest fields are renamed, bump
and validate `MANIFEST_VERSION`; otherwise retain legacy wire names while correcting
the public API and documentation.

### 7. #20 belongs in the pre-release API freeze

Live mutable arrays are exposed by Pollard getters and by the database's public
`layers` surface (`KNOWN_ISSUES.md:108-112`, `src/functions/polllard/pollard.ts:268-279`,
`src/types/denkmitdb.ts:18-27`). This is low remote-security risk but a poor stable
library contract. Return readonly snapshots or remove the public surface. The unused
tree-navigation helpers should be deleted rather than repaired unless a real caller
exists. Do this before v2, when breaking API cleanup is cheapest.

## Concrete recommended sequence

| Order | Deliverable | Why here | Effort | Risk |
|---:|---|---|---:|---:|
| 1 | **Phase 4A contract + pins:** D1/D2/#19 decisions; amend D3; acceptance tests. Include D5 and unchanged-head re-announcement as first commits. | Establishes deterministic security semantics and fixes the current live-discovery bug before more features depend on them. | M | High |
| 2 | **Creator-only access vertical slice**, then immutable ACL support. Enforce on local set and authenticated merge/load; world-writable must be explicit opt-in. | Highest-value capability and hard prerequisite for safe deletes. | L | High |
| 3 | **D6 bounded identity cache and verification budgets**, with a repeated-writer benchmark and unique-identity abuse test. | Authenticated merge made this a hot path; access control enables cheap prefiltering. | M | Medium |
| 4 | **Head discovery seam + minimal D4 persistence:** existing pubsub strategy, local-head strategy, atomic pointer, pinning, restart recovery, Keyv ownership. | Durability is more fundamental than delete and prevents a second sync refactor later. | L | High |
| 5 | **D7 logical tombstones**, no GC yet. Define resurrection, iterator/get behavior, authorization, and separate visible-key count from tree-record count. | Core KV behavior, but only safe and testable after authorization and restart recovery. | L | High |
| 6 | **#20 and v2 API cleanup:** immutable/snapshot getters, remove unused helpers, finish D2 naming and typo/deep-import changes. | Last cheap point for breaking cleanup. | M | Medium |
| 7 | **Release hardening:** two-node concurrent same-key convergence, unauthorized remote/local writes, restart recovery, late joiner, tombstone replication/restart, package smoke, docs, benchmarks. | The current 53 tests do not cover the remaining product invariants. | M | Medium |
| 8 | **Publish v2.0.0.** | Security, durability, core CRUD, and stable API are then coherent. | S | Medium |
| 9 (post-v2) | **D8 remote durable discovery:** specify publisher/name discovery and expiry/republish; implement IPNS/delegated routing; revisit Helia 7. | Large independent protocol/dependency project; not required for a coherent pubsub + local-recovery v2. | XL | High |

## Access-control acceptance criteria

The next milestone should not be considered complete until tests prove:

1. Default creator-only policy rejects an unauthorized local `set` before leaving a
   pinned garbage entry.
2. The same unauthorized signed entry is rejected through merge and full load.
3. Allowed entries produce identical decisions on replicas with different local
   identities and clocks.
4. Policy CIDs are manifest-bound and cannot be overridden at open time.
5. ACL databases converge under concurrent allowed writers.
6. Malformed/unauthorized `kid` values do not trigger unbounded identity fetches.
7. World-writable behavior requires an explicit policy, not omission/default.

## Tombstone scope for v2

Keep logical deletion before v2 if v2 is intended to be the durable protocol version;
adding it afterward would require old v2 peers to understand a new replicated record
meaning or risk resurrection. Keep the first implementation narrow:

- a signed entry variant that participates in the same composite LWW order;
- `get()` returns missing and iteration skips a winning tombstone;
- a newer put may resurrect the key;
- the tombstone remains in the Merkle tree and replication state;
- no block GC/compaction promises in v2.

The roadmap's phrase “tombstone leaf/entry type” is under-specified. Prefer keeping the
existing `SortedEntry` leaf and linking it to a versioned put/delete entry union; a
second leaf type would duplicate ordering and merge logic. Define whether `size` means
visible keys or Merkle records—today one number serves both roles
(`src/functions/denkmitdb.ts:258-270`, `src/functions/denkmitdb.ts:288-289`).

## Work that can move past v2

- **Full network IPNS/D8 and Helia 7:** defer, but ship the discovery interface now.
- **Persisted materialized index:** defer; persist/revalidate the head and rebuild.
- **HLC and hard skew enforcement:** defer unless implemented as durable quarantine
  with retry. Document wall-clock LWW in v2.
- **Tombstone GC/compaction:** defer; safe GC in a distributed system needs stronger
  knowledge than current heads provide.
- **Dynamic ACL updates:** start with immutable creator-only/allowlist policy bound by
  the manifest.
- **Unused helper arithmetic:** preferably delete before v2; if the methods are not
  public API, they need not block functionality.

## Additional release blockers the roadmap should record

- Fix the false periodic-head claim and add it as a numbered issue; current D8 text
  assumes re-broadcast behavior the code does not have.
- Pin accepted remote entries/identities or otherwise prove that a locally persisted
  head survives Helia garbage collection.
- Add the two-node concurrent same-key convergence test that Phase 1 deliberately
  deferred (`ROADMAP.md:61-64`). It is no longer timing-undefined after Phase 2.
- Update stale documentation before release: `ROADMAP.md:93` still says Phase 3 is
  partially done; `KNOWN_ISSUES.md:157-160` says D5 lands with the already-completed
  Phase 3 work; `ARCHITECTURE.md:176-178` still says conflict resolution deviates from
  LWW even though #2/#3 are fixed; and the floodsub integration test still describes
  a gossipsub mesh (`test/sync.integration.test.ts:56-65`).

## Bottom line

Do not follow access → delete → persistence → full IPNS. Secure deterministic policy
first, make authenticated merge affordable, then make local state recoverable, then
add tombstones. Ship the discovery seam and correct pubsub behavior in v2, but move
multi-writer IPNS/HTTP/Helia-7 discovery into its own post-v2 project. That sequence
delivers a smaller v2 with stronger security and durability while avoiding an
under-specified naming protocol from becoming the release's critical path.
