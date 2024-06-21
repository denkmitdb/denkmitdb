[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / Manifest

# Class: Manifest

## Implements

- [`ManifestInterface`](../../types/interfaces/ManifestInterface.md)

## Constructors

### new Manifest()

> **new Manifest**(`manifest`): [`Manifest`](Manifest.md)

#### Parameters

• **manifest**: [`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<[`ManifestData`](../../types/type-aliases/ManifestData.md)\>

#### Returns

[`Manifest`](Manifest.md)

## Properties

### access

> `readonly` **access**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The access controller CID of the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`access`](../../types/interfaces/ManifestInterface.md#access)

***

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`cid`](../../types/interfaces/ManifestInterface.md#cid)

***

### consensus

> `readonly` **consensus**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The consensus controller CID of the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`consensus`](../../types/interfaces/ManifestInterface.md#consensus)

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`creator`](../../types/interfaces/ManifestInterface.md#creator)

***

### name

> `readonly` **name**: `string`

The name of the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`name`](../../types/interfaces/ManifestInterface.md#name)

***

### order

> `readonly` **order**: `number`

The Pollard order in the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`order`](../../types/interfaces/ManifestInterface.md#order)

***

### timestamp

> `readonly` **timestamp**: `number`

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`timestamp`](../../types/interfaces/ManifestInterface.md#timestamp)

***

### type

> `readonly` **type**: `string`

The type of the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`type`](../../types/interfaces/ManifestInterface.md#type)

***

### version

> `readonly` **version**: `1`

The version of the manifest.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`version`](../../types/interfaces/ManifestInterface.md#version)

***

### link?

> `optional` `readonly` **link**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`link`](../../types/interfaces/ManifestInterface.md#link)

***

### meta?

> `optional` `readonly` **meta**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Additional metadata for the database.

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`meta`](../../types/interfaces/ManifestInterface.md#meta)

## Methods

### toJSON()

> **toJSON**(): [`ManifestData`](../../types/type-aliases/ManifestData.md)

#### Returns

[`ManifestData`](../../types/type-aliases/ManifestData.md)

#### Implementation of

[`ManifestInterface`](../../types/interfaces/ManifestInterface.md).[`toJSON`](../../types/interfaces/ManifestInterface.md#tojson)

***

### verify()

> **verify**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>
