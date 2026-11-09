[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / createDatabase

# Function: createDatabase()

> **createDatabase**\<`T`\>(`name`, `options`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Database`](../interfaces/Database.md)\<`T`\>\>

Creates a database: signs its policies and manifest with `options.identity`
and starts syncing on the node. The returned database's `address` is what
other peers open.

## Type Parameters

### T

`T`

The type of values stored in the database.

## Parameters

### name

`string`

The database name (recorded in the manifest; not unique).

### options

[`CreateDatabaseOptions`](../type-aliases/CreateDatabaseOptions.md)\<`T`\>

Node, identity, consensus rules, subtree size.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Database`](../interfaces/Database.md)\<`T`\>\>

## Throws

Error - If the options are invalid (unknown preset, bad order, malformed policy).
