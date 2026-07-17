[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createLeaf

# Function: createLeaf()

## Call Signature

> **createLeaf**(): [`LeafType`](../../types/type-aliases/LeafType.md)

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`Empty`](../../types/enumerations/LeafTypes.md#empty)

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`Hash`](../../types/enumerations/LeafTypes.md#hash)

#### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`Pollard`](../../types/enumerations/LeafTypes.md#pollard)

#### data

`CID`

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`, `creator`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`Entry`](../../types/enumerations/LeafTypes.md#entry)

#### data

`CID`

#### creator

`CID`

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`Identity`](../../types/enumerations/LeafTypes.md#identity)

#### data

`CID`

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`, `creator`, `sort`, `key`): [`LeafType`](../../types/type-aliases/LeafType.md)

### Parameters

#### type

[`SortedEntry`](../../types/enumerations/LeafTypes.md#sortedentry)

#### data

`CID`

#### creator

`CID`

#### sort

`number`[]

#### key

`string`

### Returns

[`LeafType`](../../types/type-aliases/LeafType.md)
