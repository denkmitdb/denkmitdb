[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / EntryInterface

# Interface: EntryInterface\<T\>

## Type Parameters

### T

`T`

## Properties

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

***

### key

> `readonly` **key**: `string`

***

### timestamp

> `readonly` **timestamp**: `number`

***

### version

> `readonly` **version**: [`EntryVersionType`](../type-aliases/EntryVersionType.md)

***

### deleted?

> `readonly` `optional` **deleted?**: `boolean`

True for tombstones.

***

### link?

> `readonly` `optional` **link?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

***

### manifest?

> `readonly` `optional` **manifest?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

Database the entry is bound to (v2+); undefined for legacy v1 entries.

***

### value?

> `readonly` `optional` **value?**: `T`

Present for puts; undefined for tombstones.

## Methods

### toJSON()

> **toJSON**(): [`EntryData`](../type-aliases/EntryData.md)\<`T`\>

#### Returns

[`EntryData`](../type-aliases/EntryData.md)\<`T`\>
