[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / ManifestInterface

# Interface: ManifestInterface

## Extends

- [`ManifestType`](../type-aliases/ManifestType.md)

## Properties

### access

> `readonly` **access**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The access controller CID of the database.

#### Inherited from

`ManifestType.access`

***

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`ManifestType.cid`

***

### consensus

> `readonly` **consensus**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The consensus controller CID of the database.

#### Inherited from

`ManifestType.consensus`

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`ManifestType.creator`

***

### name

> `readonly` **name**: `string`

The name of the database.

#### Inherited from

`ManifestType.name`

***

### order

> `readonly` **order**: `number`

The Pollard order in the database.

#### Inherited from

`ManifestType.order`

***

### timestamp

> `readonly` **timestamp**: `number`

#### Inherited from

`ManifestType.timestamp`

***

### type

> `readonly` **type**: `string`

The type of the database.

#### Inherited from

`ManifestType.type`

***

### version

> `readonly` **version**: `1`

The version of the manifest.

#### Inherited from

`ManifestType.version`

***

### link?

> `optional` `readonly` **link**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`ManifestType.link`

***

### meta?

> `optional` `readonly` **meta**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Additional metadata for the database.

#### Inherited from

`ManifestType.meta`

## Methods

### toJSON()

> **toJSON**(): [`ManifestData`](../type-aliases/ManifestData.md)

#### Returns

[`ManifestData`](../type-aliases/ManifestData.md)
