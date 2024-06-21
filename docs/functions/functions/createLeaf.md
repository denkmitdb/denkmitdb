[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createLeaf

# Function: createLeaf()

> **createLeaf**(`type`?, `data`?, `sortFields`?, `key`?): [`LeafType`](../../types/type-aliases/LeafType.md)

Creates a leaf node for the denkmitdb database.

## Parameters

• **type?**: [`LeafTypes`](../../types/enumerations/LeafTypes.md)

The type of the leaf node.

• **data?**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The data associated with the leaf node.

• **sortFields?**: `number`[]

An optional array of sort fields for SortedEntry type.

• **key?**: `string`

An optional key for the leaf node.

## Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

The created leaf node.

## Throws

Error if sortFields are required for SortedEntry type but not provided.
