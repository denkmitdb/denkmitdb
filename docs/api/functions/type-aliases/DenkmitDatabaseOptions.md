[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / DenkmitDatabaseOptions

# Type Alias: DenkmitDatabaseOptions\<T\>

> **DenkmitDatabaseOptions**\<`T`\> = `object`

## Type Parameters

### T

`T`

## Properties

### helia

> **helia**: [`DenkmitHeliaInterface`](DenkmitHeliaInterface.md)

***

### identity

> **identity**: [`IdentityInterface`](../interfaces/IdentityInterface.md)

***

### access?

> `optional` **access?**: [`AccessPreset`](AccessPreset.md)

Access policy for new databases (create only; open reads the manifest).
Default is **creator-only** — only the identity that created the database may
write. See [AccessPreset](AccessPreset.md).

***

### accessPolicy?

> `optional` **accessPolicy?**: [`PolicyData`](PolicyData.md)

A custom access policy for a new database, instead of a preset (create only).
json-logic over the deterministic inputs listed in docs/policies.md, including
`entryOperation` ("put" | "delete"). Mutually exclusive with `access` and
`publicWrite`.

***

### keyValueStorage?

> `optional` **keyValueStorage?**: `Keyv`\<`T`\>

***

### order?

> `optional` **order?**: `number`

Pollard order for new databases: each Merkle subtree holds 2^order leaves.
Integer in [1, 8]; default 3. Create only — open always uses the value from
the signed manifest (it defines the tree shape every replica must agree on).

***

### ~~publicWrite?~~

> `optional` **publicWrite?**: `boolean`

#### Deprecated

Use `access: "public"`. `publicWrite: true` is kept as an alias;
combining it with a different `access` preset is an error.

***

### syncController?

> `optional` **syncController?**: [`SyncControllerInterface`](../interfaces/SyncControllerInterface.md)

***

### validationPolicy?

> `optional` **validationPolicy?**: [`PolicyData`](PolicyData.md)

A custom validation policy for a new database (create only). Default accepts
every authorized entry. Same deterministic inputs as the access policy, plus
`entryTimestamp`.
