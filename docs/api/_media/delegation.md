# Spec (draft): delegation — agents that write on an owner's behalf

Status: **draft for discussion** (November 2026). Nothing here is implemented.
Revision 2 incorporates an independent review (Codex) of revision 1; §12 lists
what changed and why.
Related: [succession](https://github.com/denkmitdb/denkmitdb/pull/15) (PR #15),
`docs/policies.md`, `specs/ordering.md` §4 (determinism), KNOWN_ISSUES.md #24/#25/#31.

## 1. Why

DenkMitDB's job is signed fact exchange between parties that do not trust each
other. Today a *party* and a *key* are the same thing: every identity is one
self-certifying key, and a daemon signs everything its agents write with the
machine's single key. Two problems follow:

1. **Parties are invisible.** Another organization sees four unrelated keys
   (`seed`, `lab`, `askvivo`, `macbook`), not "Askar". Policies must list every
   key of every party (`allowlist`), and adding a machine or an agent means a new
   database.
2. **Agents are invisible.** Claude Code, Codex and Claude Desktop on one machine
   are indistinguishable, cannot be scoped (a coding agent and a mail agent get
   the same rights), and cannot be retired individually.

Delegation fixes both: an **owner** key authorizes **delegate** keys, with
limits, and every replica can check the chain from a fact back to its owner.

## 2. Goals and non-goals

Goals:

- An owner authorizes another key to write on its behalf, limited by key prefix,
  operation, time window and database.
- Chains: owner → device → agent, each link only **narrowing** the rights.
- **Deterministic verdicts:** whether an entry is acceptable is a pure function
  of the entry, the content-addressed blocks it references and the manifest.
- **Eventual convergence:** replicas that eventually hold the same blocks end up
  with the same index, even when an entry arrives before its certificates (§6).
- Policies can speak about owners (`entryOwner`) as well as signers.
- Opt-in per database (§9): existing databases, entries and presets are untouched.
- The owner key can stay **offline** (e.g. in a password manager): it only signs
  certificates, never day-to-day writes.

Non-goals (this spec):

- Bounding the damage of a **compromised** delegate key in place (§8 explains why
  no deterministic mechanism can, and what to do instead).
- Read authorization — that is encryption (`encryptValueFor`), see §10.
- Binding keys to legal/real-world identities (verifiable credentials can attest
  an owner key later).
- Isolating agents that run as the **same OS user** from each other (§11).

## 3. Model

- **Owner**: an ordinary identity (self-certifying key, identity CID). Usually one
  per person or organization.
- **Delegate**: an identity that holds a valid chain back to an owner — a device
  daemon, or an agent on that device.
- **Delegation certificate** (*cert*): a signed, content-addressed block in which
  an *issuer* authorizes an *audience* identity within a *scope*.
- **Chain**: certs `c1 … cn` (n ≤ 3) where `c1.issuer` is the owner, each
  `ck.audience == c(k+1).issuer`, and `cn.audience` signed the entry. All
  identities in a chain are distinct (no `issuer == audience`, no cycles).

## 4. Formats

### 4.1 Delegation certificate

A signed block (the JWS-over-dag-cbor envelope used for identities, manifests
and entries — `HeliaController.addSigned`). Payload:

```
{
  version:    1,
  type:       "denkmit-delegation",
  issuer:     CID,          // MUST equal the authenticated signer of this block
  audience:   CID,          // identity being authorized; != issuer
  name:       string,       // label for the audience, e.g. "lab", "codex"; [a-z0-9-]{1,32}
  database:   CID,          // the database this cert is valid in (required by default)
  scope: {
    prefixes:   string[],   // 1..16 entries, each ending in "/", ≤ 256 bytes
    operations: ("put" | "delete")[]    // non-empty, no duplicates
  },
  notBefore:  integer,      // ms since epoch, safe integer, inclusive
  notAfter:   integer,      // ms since epoch, safe integer, exclusive, > notBefore
  parent?:    CID           // cert that authorized `issuer`; absent at the root
}
```

Shape rules (enforced before anything else; a cert violating any is invalid):
encoded block ≤ 4 KiB; unknown fields rejected; CIDs compared by their canonical
CIDv1 bytes, never by string form.

**Database binding.** `database` is required. A cert valid in every database the
owner can write to is a deliberate exception, spelled `database: null` and
`anyDatabase: true` together; tooling never produces it by default. (Revision 1
made binding optional — a grant meant for staging would then also work in
production.)

### 4.2 Scope semantics

- **Segment-aware prefixes.** Every prefix ends with `/`, and an entry key
  matches a prefix iff `key.startsWith(prefix)`. Because of the trailing slash,
  `agents/x/` never matches `agents/xy/…`.
- **Placeholders** `{owner}`, `{issuer}` and `{audience}` are expanded **once,
  per cert**, with that cert's own `issuer`/`audience` and the chain's root issuer,
  as canonical base32 CIDv1 strings, before any comparison. Expansion never
  re-binds a parent's placeholders to a child's identities.
- **Narrowing** (child within parent): every expanded child prefix starts with
  some expanded parent prefix; child operations ⊆ parent operations; the child
  window ⊆ the parent window; same `database` (or the parent is `anyDatabase`).

Example layout, consistent end to end:

| Cert | issuer → audience | prefixes |
|---|---|---|
| device | owner → `lab` daemon | `agents/{owner}/lab/` |
| agent | `lab` daemon → `codex` key | `agents/{owner}/lab/codex/` |

### 4.3 Entry v3

`ENTRY_VERSION` 3 adds one field to the signed entry payload:

```
delegation: CID   // the leaf cert of the chain the signer claims (required in v3)
```

Inside the signed payload, so nobody can attach a different chain to someone
else's entry. Undelegated writes in a delegation-enabled database stay v2.

## 5. Verification (deterministic)

For an entry `e` signed by `S` in database `D`, with `e.delegation = L`:

1. **Fetch and authenticate** each cert walking `parent` from `L`: verify the
   block's signature and require **`verifiedSigner == cert.issuer`** (the signed
   payload's claim is not enough — otherwise anyone could sign "Alice delegates to
   me"). Apply the shape rules of §4.1. Chain length ≤ 3, identities distinct.
2. **Links:** `L.audience == S`; `child.issuer == parent.audience`; the root has
   no `parent`; `owner := root.issuer`.
3. **Narrowing** for every link (§4.2).
4. **Applicability** to `e`, for **every** link: `e.key` matches one of its
   prefixes, `operation(e)` is allowed, `notBefore ≤ e.timestamp < notAfter`,
   and `database == D` (unless `anyDatabase`).
5. **Verdict.** Valid → policy inputs from §7. Invalid → the entry is
   **rejected for good** (it can never become valid: its inputs are immutable).
   Unverifiable because a cert block is missing → **pending** (§6), not rejected.

Certs are cached and pinned by CID, like identities. Their work is bounded per
chain (≤ 3 certs × ≤ 4 KiB, ≤ 16 prefixes each) and is **not** charged against
the tree-walk budget (KNOWN_ISSUES.md #26): one device cert shared by thousands of
entries is normal, and repeated certs must never look like a repeated pollard.

## 6. Pending entries and convergence

Pure verdicts are not enough. Today `processLeafMerging` skips an entry it cannot
verify, and the index keeps only last-write-wins winners. Scenario: replica A
receives a delegated winner E before E's cert, skips it and keeps an older F;
replica B accepts E, later overwrites it with G and goes offline. When A finally
gets the cert, nobody re-announces E, so A never reconsiders it — although A and
B now hold the same blocks.

Rules:

1. **Durable pending set.** An entry whose verdict is "pending" is recorded
   (entry CID, signed key/timestamp, missing cert CIDs) in the local datastore,
   surviving restarts. It is not indexed and does not enter the tree.
2. **Dependency-triggered retry.** When a missing cert arrives (fetched for any
   entry, or announced), every pending entry waiting on it is re-verified and, if
   valid, goes through normal last-write-wins indexing — exactly as if it had
   arrived now. A periodic retry with backoff fetches missing certs from peers.
3. **`load()` is atomic.** A full replacement first collects verdicts for all
   leaves; pending entries are recorded, not dropped, and local state is
   replaced only after the walk completes (extending today's two-phase load).
4. **Convergence argument.** A replica's index is the LWW winner set over
   {entries with a valid verdict}. Verdicts are pure; pending entries become
   valid as soon as their certs are local; so two replicas with the same blocks
   compute the same set — independent of arrival order.

This also closes the same gap for ordinary unfetchable entries, which have it
today.

## 7. Policy inputs and presets

New inputs, available **only** in delegation-enabled databases (§9):

| Input | Undelegated (v2) entry | Delegated (v3) entry |
|---|---|---|
| `entryCreator` | signer | signer (the delegate) |
| `entryOwner` | = signer | chain root issuer |
| `entryAgent` | = signer | signer |
| `entryDelegated` | `false` | `true` |
| `entryChainLength` | `0` | `1`–`3` |

Narrowing keeps a chain monotonic; it does **not** mean a delegate can never do
more than its owner directly — a policy may deliberately treat delegated and
direct writes differently (e.g. "owners write only through devices"). Presets
for delegation-enabled databases:

- **`namespace-per-owner`**: `startsWith(entryKey, "agents/" + entryOwner + "/")` —
  each party owns one namespace; its devices and agents write inside it under the
  prefixes their certs allow.
- **`{ allowlist, by: "owner" }`**: listed owners, and anyone they delegate to.

## 8. Expiry, revocation and compromise

- **Expiry** is checked against the entry's **signed timestamp** — the only time
  all replicas agree on. It stops an *honest* delegate from writing after its
  window, and short windows renewed automatically make retiring an agent cheap.
- **Expiry does not bound a compromise.** Timestamps are chosen by the signer
  (ordering.md §4). A stolen delegate key can keep manufacturing entries dated
  inside any window it ever held — forever, not just until the window ends.
- **Revocation cut-offs are deterministic but weak.** An authenticated
  "cert C is revoked from T" record could deterministically reject entries with
  signed timestamp ≥ T — and a thief back-dates below T. Worse, revocation
  knowledge is *mutable state*: the verdict for an entry would depend on whether a
  replica has seen the revocation, which breaks the entry-only model of §5 and
  requires re-deriving winners for affected keys (the index keeps only winners).
  Not specified here (§13.1).
- **The deterministic remedy is a checkpoint.** After a key compromise the owner
  performs a **succession** (PR #15): a successor database whose manifest names
  an explicit retained set of entries (and a policy or allowlist that excludes the
  stolen key's chain). Every replica derives the same successor state; whatever
  the thief signs afterwards is bound to the old database and rejected by entry
  binding (#24).

## 9. Opt-in, versioning and migration

- **Manifest v3** with `features: ["delegation"]` enables delegation for a new
  database. Only such databases accept v3 entries and see the new policy inputs;
  in v1/v2-manifest databases nothing changes (no new variables appear in
  existing custom policies).
- **Version gating.** 4.0.0 replicas reject manifest v3 at open
  (`assertManifestShape`), so they cannot silently join a delegation database and
  diverge on its v3 entries — a clean failure, not a fork. Delegation ships in a
  minor release that understands v3; nodes must upgrade before joining.
- **Migration** of an existing database: create a delegation-enabled successor
  (succession, PR #15) or a new database. Existing machine identities become
  devices: the owner signs one device cert per machine. Facts already written
  stay attributed to the machine keys; new facts are attributable to the owner.
  Note that existing presets read `entryCreator` and will keep rejecting new agent
  signers — another reason migration goes through a new manifest.

## 10. Encryption with delegation

`encryptValueFor` targets identities; delegation does not change that:

- to an **agent** key → only that agent's sessions (§11) read it;
- to a **device** key → every agent the device daemon serves reads it;
- to the **owner** → only where the owner key is present (ideally offline).

Encryption and write authority are independent. Revoking or expiring a write cert
does not retract anything already decryptable with that key; a stolen key reads
everything ever sealed to it. Seal to the narrowest identity that needs it.

## 11. Daemon sessions and local isolation

- The daemon holds the device key and one key per configured agent
  (`DENKMIT_AGENTS=claude-code,codex,desktop`), issues each agent a short-lived
  cert (default 7 days, `agents/{owner}/<device>/<agent>/`) and renews it before
  expiry.
- **Selecting an identity is not authenticating it.** A thin client asking for
  `DENKMIT_AGENT=codex` over the user's socket proves nothing: any process of the
  same OS user could ask for any agent. Each agent gets its own socket
  (`denkmitd-<agent>.sock`) and a per-agent session token written into that
  agent's MCP config; the daemon binds each session to exactly one identity and
  scope. This prevents mistakes and casual misuse — **it is not a security
  boundary against code running as the same user**, which can read the configs
  and the daemon's keys.
- **The security boundary is the OS user.** Agents that must not impersonate each
  other run as different users with their own daemons (or sockets owned by
  separate users), each holding only its own key.
- Device compromise exposes every key the daemon holds; the remedy is §8's
  checkpoint plus re-issuing device and agent certs.
- **Owner CLI:** `denkmit delegate --to <device CID> --name lab --database <cid>
  --prefix 'agents/{owner}/lab/' --days 90` signs a device cert with the owner key
  (read from a file or a password-manager export) and prints the cert CID for the
  device's config (`DENKMIT_DELEGATION=<cid>`).
- **MCP surface:** `memory_status` shows owner, device, agent and the cert
  window; `memory_provenance` returns `owner`, `agent` and `chain`.

## 12. Changes from revision 1 (review findings)

1. Issuer bound to the authenticated signer; strict cert shape and limits (§4.1, §5.1).
2. Durable pending set, dependency-triggered retry, atomic load, convergence argument (§6).
3. Cert work bounded per chain and kept out of the tree-walk budget (§5).
4. Segment-aware prefixes; placeholders expanded once per cert; consistent example (§4.2).
5. Database binding required by default; explicit `anyDatabase` (§4.1).
6. Revocation analysis corrected: cut-offs are deterministic but bypassed by
   back-dating and depend on mutable state; expiry does not bound compromise;
   checkpoint (succession) is the deterministic remedy (§8).
7. Session binding and an honest statement of the local isolation boundary (§11).
8. Opt-in via manifest v3 with version gating and an explicit migration path (§9).
9. Narrowing no longer overclaimed as "delegates never exceed owners" (§7).

## 13. Open questions

1. **Revocation records** beyond checkpoints: worth the mutable-state and
   winner-recomputation cost, or is succession enough?
2. **Chain depth 3** — enough for owner → device → agent; a case for sub-agents?
3. **Prefix-only scopes** — enough, or are exclusions needed?
4. **Clock skew** for short certs — how much slack must renewal leave?
5. **Interop.** UCAN 1.0 delegation (`iss`/`aud`/`sub`/`cmd`/`pol`/`nbf`/`exp`)
   and Willow's Meadowcap (area-based attenuation over namespaces, subspaces and
   paths) are both capability chains with attenuation. Neither maps onto
   DenkMitDB without a profile (a resource model for UCAN, a namespace/path
   mapping for Meadowcap). This draft keeps a small custom format; before
   implementation, write the concrete mapping to at least one of them and decide
   whether the interop is worth the fit.
