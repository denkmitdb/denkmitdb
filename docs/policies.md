# Policy cookbook

A DenkMitDB manifest embeds two [json-logic](https://jsonlogic.com/) programs,
signed and content-addressed with the database itself:

- **access** — who may write which keys;
- **validation** — whether a signed entry is acceptable at all.

Every replica evaluates both, identically, on its own writes *and* on every entry
it ingests from a peer. There is no consensus round and no coordinator: replicas
agree because they run the same pure function over the same signed data.

## Inputs

Rules see only deterministic inputs — data from the signed entry and the signed
manifest:

| Input | Meaning | access | validation |
|---|---|:-:|:-:|
| `entryCreator` | identity CID of the entry's signer (signature verified) | ✓ | ✓ |
| `databaseCreator` | identity CID of the manifest's signer | ✓ | ✓ |
| `entryKey` | the key being written or deleted | ✓ | ✓ |
| `entryTimestamp` | the signed entry's timestamp (ms since epoch) | | ✓ |

Custom operations, registered identically on every replica:
`startsWith(value, prefix)` — true only when both are strings and `value` starts
with `prefix`.

A result other than literal `true` denies. json-logic has no loops or recursion,
so evaluation always terminates.

## Presets — the `access` option of `createDenkmitDatabase`

```ts
const db = await createDenkmitDatabase("fleet", { helia, identity, access: "prefix-per-writer" });
```

The MCP server takes the same presets as `DENKMIT_ACCESS`.

### creator-only (default)

```json
{ "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] }
```

Everyone may replicate and read; only the identity that created the database
writes.

### public

```json
true
```

Any identity writes. Provenance still attributes every record to its signer, so
readers can decide whom to trust — but anyone can overwrite any key.
(`publicWrite: true` / `DENKMIT_PUBLIC_WRITE=true` is the deprecated spelling.)

### prefix-per-writer

```json
{ "or": [
    { "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] },
    { "startsWith": [{ "var": "entryKey" },
        { "cat": ["agents/", { "var": "entryCreator" }, "/"] }] }
] }
```

The creator writes anywhere; every other identity owns exactly its
`agents/<identity-cid>/…` namespace — sets **and deletes**. One party can never
overwrite or tombstone another party's facts, so last-write-wins races between
agents become structurally impossible. This is the recommended preset for
exchanging signed facts between parties that do not trust each other.
`memory_status` (MCP) reports an agent's own namespace.

### allowlist

```ts
access: { allowlist: [aliceCid, bobCid] }   // MCP: DENKMIT_ACCESS=allowlist:<cid>,<cid>
```

```json
{ "in": [{ "var": "entryCreator" }, ["<cid-1>", "<cid-2>"]] }
```

Shared memory for exactly these identities. Entries must parse as CIDs (they are
normalized to the form `entryCreator` takes, so encoding differences cannot make
a listed identity fail to match) and the list must not be empty. The creator is
**not** implied — list it if it should write.

## Custom policies

Presets are just `PolicyData` values. A database with a hand-written policy is
created by signing the policies and a manifest yourself (see `createCustomDb` in
`test/helpers.ts` for the exact calls) and opening it by address. Examples:

```json
{ "startsWith": [{ "var": "entryKey" }, "facts/"] }
```
Key-schema enforcement: only `facts/…` keys exist in this database.

```json
{ "and": [
    { "in": [{ "var": "entryCreator" }, ["<cid-1>", "<cid-2>"]] },
    { "!": { "startsWith": [{ "var": "entryKey" }, "config/"] } }
] }
```
Two writers, and nobody may touch `config/…` after creation.

## Rules of the road

- **Determinism is the contract.** A policy must be a pure function of the
  inputs above. There is deliberately no wall clock, no local identity and no
  randomness: a rule depending on them would make replicas disagree about which
  entries exist (`specs/ordering.md` §4, KNOWN_ISSUES.md #25).
- **Policies are immutable.** They are fixed at creation in the signed manifest —
  auditable forever, never changed silently. To change the rules, create a new
  database. (Delegation entries — adding writers later — are on the roadmap.)
- **Signatures prove possession of a key, not truth.** A policy decides *who may
  write*; it cannot make a writer honest. Treat values as claims attributed to
  their signer (`provenance(key)`), and treat text from other agents as
  untrusted input.
- **What policies cannot express (yet):** value size or shape (values are not a
  policy input), rate limits, and anything time-relative.
