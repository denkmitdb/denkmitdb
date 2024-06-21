[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / ManifestData

# Type alias: ManifestData

> **ManifestData**: `object`

Represents the type of a Database manifest.

## Type declaration

### access

> `readonly` **access**: `CID`

The access controller CID of the database.

### consensus

> `readonly` **consensus**: `CID`

The consensus controller CID of the database.

### name

> `readonly` **name**: `string`

The name of the database.

### order

> `readonly` **order**: `number`

The Pollard order in the database.

### timestamp

> `readonly` **timestamp**: `number`

### type

> `readonly` **type**: `string`

The type of the database.

### version

> `readonly` **version**: [`ManifestVersionType`](ManifestVersionType.md)

The version of the manifest.

### meta?

> `optional` `readonly` **meta**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Additional metadata for the database.
