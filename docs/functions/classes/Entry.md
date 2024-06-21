[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / Entry

# Class: Entry\<T\>

## Type parameters

• **T**

## Implements

- [`EntryInterface`](../../types/interfaces/EntryInterface.md)\<`T`\>

## Constructors

### new Entry()

> **new Entry**\<`T`\>(`entry`): [`Entry`](Entry.md)\<`T`\>

#### Parameters

• **entry**: [`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<[`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>\>

#### Returns

[`Entry`](Entry.md)\<`T`\>

## Properties

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`cid`](../../types/interfaces/EntryInterface.md#cid)

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

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

### value

> `readonly` **value**: `T`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`value`](../../types/interfaces/EntryInterface.md#value)

***

### version

> `readonly` **version**: `1` = `ENTRY_VERSION`

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`version`](../../types/interfaces/EntryInterface.md#version)

***

### link?

> `optional` `readonly` **link**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`link`](../../types/interfaces/EntryInterface.md#link)

## Methods

### toJSON()

> **toJSON**(): [`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>

#### Returns

[`EntryData`](../../types/type-aliases/EntryData.md)\<`T`\>

#### Implementation of

[`EntryInterface`](../../types/interfaces/EntryInterface.md).[`toJSON`](../../types/interfaces/EntryInterface.md#tojson)
