[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createEntry

# Function: createEntry()

> **createEntry**\<`T`\>(`key`, `value`, `heliaController`, `manifest?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../interfaces/EntryInterface.md)\<`T`\>\>

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

[`HeliaControllerInterface`](../interfaces/HeliaControllerInterface.md)

The Helia controller interface.

### manifest?

`CID`\<`unknown`, `number`, `number`, `Version`\>

The address of the database the entry is written to. Bound
  into the signed payload so the entry cannot be replayed into another database
  (KNOWN_ISSUES.md #24). Omitting it produces a legacy v1 entry, which only
  legacy (v1-manifest) databases accept.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../interfaces/EntryInterface.md)\<`T`\>\>

A promise that resolves to the created entry.
