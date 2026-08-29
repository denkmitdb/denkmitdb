[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createLeaf

# Function: createLeaf()

## Call Signature

> **createLeaf**(): [`LeafType`](../type-aliases/LeafType.md)

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`Empty`](../enumerations/LeafTypes.md#empty)

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`Hash`](../enumerations/LeafTypes.md#hash)

#### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`Pollard`](../enumerations/LeafTypes.md#pollard)

#### data

`CID`

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`, `creator`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`Entry`](../enumerations/LeafTypes.md#entry)

#### data

`CID`

#### creator

`CID`

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`Identity`](../enumerations/LeafTypes.md#identity)

#### data

`CID`

### Returns

[`LeafType`](../type-aliases/LeafType.md)

## Call Signature

> **createLeaf**(`type`, `data`, `creator`, `sort`, `key`): [`LeafType`](../type-aliases/LeafType.md)

### Parameters

#### type

[`SortedEntry`](../enumerations/LeafTypes.md#sortedentry)

#### data

`CID`

#### creator

`CID`

#### sort

`number`[]

#### key

`string`

### Returns

[`LeafType`](../type-aliases/LeafType.md)
