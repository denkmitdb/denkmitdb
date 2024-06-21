[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createDenkmitDatabase

# Function: createDenkmitDatabase()

> **createDenkmitDatabase**\<`T`\>(`name`, `options`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>\>

Creates a Denkmit database with the specified name and options.

## Type parameters

• **T**

The type of data stored in the database.

## Parameters

• **name**: `string`

The name of the database.

• **options**: [`DenkmitDatabaseOptions`](../../types/type-aliases/DenkmitDatabaseOptions.md)\<`T`\>

The options for configuring the database.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>\>

A promise that resolves to the created DenkmitDatabaseInterface.
