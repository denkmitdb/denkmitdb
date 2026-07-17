[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createEntry

# Function: createEntry()

> **createEntry**\<`T`\>(`key`, `value`, `heliaController`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>\>

Creates a new entry with the specified key and value.

## Type Parameters

### T

`T`

The type of the value.

## Parameters

### key

`string`

The key of the entry.

### value

`T`

The value of the entry.

### heliaController

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

The Helia controller interface.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>\>

A promise that resolves to the created entry.
