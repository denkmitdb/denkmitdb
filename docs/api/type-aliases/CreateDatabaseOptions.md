[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / CreateDatabaseOptions

# Type Alias: CreateDatabaseOptions\<T\>

> **CreateDatabaseOptions**\<`T`\> = [`DatabaseOptions`](DatabaseOptions.md)\<`T`\> & `object`

Options for creating a database: the open options plus what the manifest fixes for good.

## Type Parameters

### T

`T`

## Type Declaration

### consensus?

> `optional` **consensus?**: `object`

Consensus rules. Default: access "creator-only", validity accepts every authorized entry.

#### consensus.access?

> `optional` **access?**: [`AccessRule`](AccessRule.md)

#### consensus.validity?

> `optional` **validity?**: [`PolicyDefinition`](PolicyDefinition.md)

### subtreeLeaves?

> `optional` **subtreeLeaves?**: `number`

Leaves per Merkle subtree: a power of two in [2, 256]; default 8.
