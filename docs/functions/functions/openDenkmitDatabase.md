[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / openDenkmitDatabase

# Function: openDenkmitDatabase()

> **openDenkmitDatabase**\<`T`\>(`cid`, `options`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>\>

Opens a Denkmit database.

## Type Parameters

### T

`T`

The type of data stored in the database.

## Parameters

### cid

`CID`

The CID (Content Identifier) of the database.

### options

[`DenkmitDatabaseOptions`](../../types/type-aliases/DenkmitDatabaseOptions.md)\<`T`\>

The options for opening the database.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>\>

A promise that resolves to a DenkmitDatabaseInterface instance.
