[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / Entry

# Class: Entry\<T\>

## Type Parameters

### T

`T`

## Implements

- [`EntryInterface`](../interfaces/EntryInterface.md)\<`T`\>

## Constructors

### Constructor

> **new Entry**\<`T`\>(`entry`): `Entry`\<`T`\>

#### Parameters

##### entry

[`DenkmitData`](../type-aliases/DenkmitData.md)\<[`EntryData`](../type-aliases/EntryData.md)\<`T`\>\>

#### Returns

`Entry`\<`T`\>

## Properties

### cid

> `readonly` **cid**: `CID`

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`cid`](../interfaces/EntryInterface.md#cid)

***

### creator

> `readonly` **creator**: `CID`

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`creator`](../interfaces/EntryInterface.md#creator)

***

### key

> `readonly` **key**: `string`

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`key`](../interfaces/EntryInterface.md#key)

***

### timestamp

> `readonly` **timestamp**: `number`

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`timestamp`](../interfaces/EntryInterface.md#timestamp)

***

### version

> `readonly` **version**: `1` = `ENTRY_VERSION`

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`version`](../interfaces/EntryInterface.md#version)

***

### deleted?

> `readonly` `optional` **deleted?**: `boolean`

True for tombstones.

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`deleted`](../interfaces/EntryInterface.md#deleted)

***

### link?

> `readonly` `optional` **link?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`link`](../interfaces/EntryInterface.md#link)

***

### value?

> `readonly` `optional` **value?**: `T`

Present for puts; undefined for tombstones.

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`value`](../interfaces/EntryInterface.md#value)

## Methods

### toJSON()

> **toJSON**(): [`EntryData`](../type-aliases/EntryData.md)\<`T`\>

#### Returns

[`EntryData`](../type-aliases/EntryData.md)\<`T`\>

#### Implementation of

[`EntryInterface`](../interfaces/EntryInterface.md).[`toJSON`](../interfaces/EntryInterface.md#tojson)
