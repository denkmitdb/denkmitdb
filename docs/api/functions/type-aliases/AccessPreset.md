[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / AccessPreset

# Type Alias: AccessPreset

> **AccessPreset** = `"creator-only"` \| `"public"` \| `"prefix-per-writer"` \| \{ `allowlist`: `string`[]; \}

Access preset for a NEW database (create only — open always reads the policy
from the signed manifest). Compiles to a json-logic access policy:
- "creator-only" (default): only the creating identity writes.
- "public": any identity writes (provenance still attributes every record).
- "prefix-per-writer": the creator writes anywhere; any other identity writes
  (and deletes) only under `agents/<its-identity-cid>/…`.
- `{ allowlist }`: exactly the listed identity CIDs write.

See docs/policies.md.
