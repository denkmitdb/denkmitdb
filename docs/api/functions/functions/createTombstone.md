[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createTombstone

# Function: createTombstone()

> **createTombstone**\<`T`\>(`key`, `heliaController`, `manifest?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../interfaces/EntryInterface.md)\<`T`\>\>

Creates a signed tombstone for the specified key: a delete record that
participates in the same composite last-write-wins order as puts. A winning
tombstone hides the key; a newer put resurrects it (specs/ordering.md).

## Type Parameters

### T

`T`

## Parameters

### key

`string`

The key to delete.

### heliaController

[`HeliaControllerInterface`](../interfaces/HeliaControllerInterface.md)

The Helia controller interface.

### manifest?

`CID`\<`unknown`, `number`, `number`, `Version`\>

The database address to bind the tombstone to (see createEntry).

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../interfaces/EntryInterface.md)\<`T`\>\>

A promise that resolves to the created tombstone entry.
