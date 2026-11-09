[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / openDatabase

# Function: openDatabase()

> **openDatabase**\<`T`\>(`address`, `options`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Database`](../interfaces/Database.md)\<`T`\>\>

Opens a database by address: fetches and verifies its manifest and policies,
restores the locally persisted head, and starts syncing. The consensus rules
always come from the signed manifest, never from local options.

## Type Parameters

### T

`T`

The type of values stored in the database.

## Parameters

### address

`string` \| `CID`\<`unknown`, `number`, `number`, `Version`\>

The database address (manifest CID), as a CID or string.

### options

[`DatabaseOptions`](../type-aliases/DatabaseOptions.md)\<`T`\>

Node and identity.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Database`](../interfaces/Database.md)\<`T`\>\>
