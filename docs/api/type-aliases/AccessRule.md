[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / AccessRule

# Type Alias: AccessRule

> **AccessRule** = `"creator-only"` \| `"public"` \| `"prefix-per-writer"` \| `"namespace-per-writer"` \| \{ `allowlist`: `string`[]; \} \| \{ `policy`: [`PolicyDefinition`](PolicyDefinition.md); \}

The access rule of a new database (create only — open always reads it from the
signed manifest). A preset compiles to a json-logic policy:
- "creator-only" (default): only the creating identity writes.
- "public": any identity writes (provenance still attributes every record).
- "prefix-per-writer": the creator writes anywhere; any other identity writes
  (and deletes) only under `agents/<its-identity-cid>/…`.
- "namespace-per-writer": every identity, the creator included, writes and
  deletes only under `agents/<its-identity-cid>/…` — no privileged party.
- `{ allowlist }`: exactly the listed identity CIDs write.
- `{ policy }`: a custom json-logic access policy.

See docs/policies.md.
