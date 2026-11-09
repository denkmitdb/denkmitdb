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
| `entryOperation` | `"put"` or `"delete"` (a signed tombstone) | ✓ | ✓ |
| `entryTimestamp` | the signed entry's timestamp (ms since epoch) | | ✓ |

Custom operations, registered identically on every replica:
`startsWith(value, prefix)` — true only when both are strings and `value` starts
with `prefix`.

A result other than literal `true` denies, and so does a rule that throws (an
unknown operation, say) — on every replica alike. json-logic has no loops or
recursion, so evaluation always terminates.

## Presets — the `access` option of `createDatabase`

```ts
const db = await createDatabase("fleet", { helia, identity, access: "prefix-per-writer" });
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

### prefix-per-writer

```json
{ "or": [
    { "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] },
    { "startsWith": [{ "var": "entryKey" },
        { "cat": ["agents/", { "var": "entryCreator" }, "/"] }] }
] }
```

The creator writes anywhere; every other identity owns exactly its
`agents/<identity-cid>/…` namespace — sets **and deletes**. Other parties can
never overwrite or tombstone each other's facts — but the creator can. Use it when
the creator is a trusted coordinator; otherwise use `namespace-per-writer`.

### namespace-per-writer

```json
{ "startsWith": [{ "var": "entryKey" },
    { "cat": ["agents/", { "var": "entryCreator" }, "/"] }] }
```

Every identity — **the creator included** — owns exactly its
`agents/<identity-cid>/…` namespace, and nobody else's. No party is privileged,
so last-write-wins races between parties are structurally impossible and a
fast clock can only ever shadow the writer's own facts. This is the recommended
preset for exchanging signed facts between parties that do not trust each other.
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

Presets are just `PolicyDefinition` values; you can pass your own instead. They are
checked when the database is created and then signed into its manifest for good:

```ts
const db = await createDatabase("team", {
    helia,
    identity,
    accessPolicy: { version: 1, name: "…", description: "…", logic: { /* json-logic */ } },
    validationPolicy: { version: 1, name: "…", description: "…", logic: { /* json-logic */ } },
});
```

`accessPolicy` replaces the `access` preset (the types allow one or the other); the
default `validationPolicy` accepts everything. The MCP server reads the same two
objects from a JSON file named by `DENKMIT_POLICY_FILE`:
`{ "accessPolicy": { … }, "validationPolicy": { … } }`. Examples:

```json
{ "or": [
    { "==": [{ "var": "entryOperation" }, "put"] },
    { "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] }
] }
```
Anyone may write; only the creator may delete.

```json
{ "and": [
    { "startsWith": [{ "var": "entryKey" }, "facts/"] },
    { "==": [{ "var": "entryOperation" }, "put"] }
] }
```
As a validation policy: only `facts/…` keys exist, and nothing is ever deleted.
(A policy can refuse tombstones; it cannot un-publish data a writer already
signed and shared — no content-addressed P2P system can.)

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
