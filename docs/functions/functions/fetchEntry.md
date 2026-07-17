[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / fetchEntry

# Function: fetchEntry()

> **fetchEntry**\<`T`\>(`cid`, `heliaController`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>\>

Fetches an entry from the database based on the given CID.

## Type Parameters

### T

`T`

The type of the entry data.

## Parameters

### cid

`CID`

The CID of the entry to fetch.

### heliaController

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

The Helia controller instance.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>\>

- A promise that resolves to the fetched entry.

## Throws

- If the entry is not found or the entry data is not found.
