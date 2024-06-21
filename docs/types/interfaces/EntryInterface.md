[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / EntryInterface

# Interface: EntryInterface\<T\>

## Extends

- [`EntryType`](../type-aliases/EntryType.md)\<`T`\>

## Type parameters

• **T**

## Properties

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`EntryType.cid`

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`EntryType.creator`

***

### key

> `readonly` **key**: `string`

#### Inherited from

`EntryType.key`

***

### timestamp

> `readonly` **timestamp**: `number`

#### Inherited from

`EntryType.timestamp`

***

### value

> `readonly` **value**: `T`

#### Inherited from

`EntryType.value`

***

### version

> `readonly` **version**: `1`

#### Inherited from

`EntryType.version`

***

### link?

> `optional` `readonly` **link**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`EntryType.link`

## Methods

### toJSON()

> **toJSON**(): [`EntryData`](../type-aliases/EntryData.md)\<`T`\>

#### Returns

[`EntryData`](../type-aliases/EntryData.md)\<`T`\>
