[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / Manifest

# Class: Manifest

## Implements

- [`ManifestInterface`](../interfaces/ManifestInterface.md)

## Constructors

### Constructor

> **new Manifest**(`manifest`): `Manifest`

#### Parameters

##### manifest

[`DenkmitData`](../type-aliases/DenkmitData.md)\<[`ManifestData`](../type-aliases/ManifestData.md)\>

#### Returns

`Manifest`

## Properties

### access

> `readonly` **access**: `CID`

The access controller CID of the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`access`](../interfaces/ManifestInterface.md#access)

***

### cid

> `readonly` **cid**: `CID`

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`cid`](../interfaces/ManifestInterface.md#cid)

***

### consensus

> `readonly` **consensus**: `CID`

The consensus controller CID of the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`consensus`](../interfaces/ManifestInterface.md#consensus)

***

### creator

> `readonly` **creator**: `CID`

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`creator`](../interfaces/ManifestInterface.md#creator)

***

### name

> `readonly` **name**: `string`

The name of the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`name`](../interfaces/ManifestInterface.md#name)

***

### order

> `readonly` **order**: `number`

The Pollard order in the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`order`](../interfaces/ManifestInterface.md#order)

***

### timestamp

> `readonly` **timestamp**: `number`

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`timestamp`](../interfaces/ManifestInterface.md#timestamp)

***

### type

> `readonly` **type**: `string`

The type of the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`type`](../interfaces/ManifestInterface.md#type)

***

### version

> `readonly` **version**: `1`

The version of the manifest.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`version`](../interfaces/ManifestInterface.md#version)

***

### link?

> `readonly` `optional` **link?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`link`](../interfaces/ManifestInterface.md#link)

***

### meta?

> `readonly` `optional` **meta?**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Additional metadata for the database.

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`meta`](../interfaces/ManifestInterface.md#meta)

## Methods

### toJSON()

> **toJSON**(): [`ManifestData`](../type-aliases/ManifestData.md)

#### Returns

[`ManifestData`](../type-aliases/ManifestData.md)

#### Implementation of

[`ManifestInterface`](../interfaces/ManifestInterface.md).[`toJSON`](../interfaces/ManifestInterface.md#tojson)

***

### verify()

> **verify**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>
