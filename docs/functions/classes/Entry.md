[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / Entry

# Class: Entry\<T\>

## Type Parameters

### T

`T`

## Implements

- [`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>

## Constructors

### Constructor

> **new Entry**\<`T`\>(`entry`): `Entry`\<`T`\>

#### Parameters

##### entry

[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<[`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>\>

#### Returns

`Entry`\<`T`\>

## Properties

### cid

> `readonly` **cid**: `CID`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`cid`](../../types/interfaces/EntryInterface.md#cid)

***

### creator

> `readonly` **creator**: `CID`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`creator`](../../types/interfaces/EntryInterface.md#creator)

***

### key

> `readonly` **key**: `string`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`key`](../../types/interfaces/EntryInterface.md#key)

***

### timestamp

> `readonly` **timestamp**: `number`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`timestamp`](../../types/interfaces/EntryInterface.md#timestamp)

***

### version

> `readonly` **version**: `1` = `ENTRY_VERSION`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`version`](../../types/interfaces/EntryInterface.md#version)

***

### deleted?

> `readonly` `optional` **deleted?**: `boolean`

True for tombstones.

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`deleted`](../../types/interfaces/EntryInterface.md#deleted)

***

### link?

> `readonly` `optional` **link?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`link`](../../types/interfaces/EntryInterface.md#link)

***

### value?

> `readonly` `optional` **value?**: `T`

Present for puts; undefined for tombstones.

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`value`](../../types/interfaces/EntryInterface.md#value)

## Methods

### toJSON()

> **toJSON**(): [`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>

#### Returns

[`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`toJSON`](../../types/interfaces/EntryInterface.md#tojson)
