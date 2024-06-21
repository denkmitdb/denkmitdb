[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / DenkmitDatabaseInterface

# Interface: DenkmitDatabaseInterface\<T\>

Represents the interface for the Denkmit database.

## Extends

- [`DenkmitDatabaseType`](../type-aliases/DenkmitDatabaseType.md)\<`T`\>

## Type parameters

• **T**

The type of values stored in the database.

## Properties

### address

> `readonly` **address**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`DenkmitDatabaseType.address`

***

### heliaController

> `readonly` **heliaController**: [`HeliaControllerInterface`](HeliaControllerInterface.md)

#### Inherited from

`DenkmitDatabaseType.heliaController`

***

### identity

> `readonly` **identity**: [`IdentityInterface`](IdentityInterface.md)

#### Inherited from

`DenkmitDatabaseType.identity`

***

### keyValueStorage

> `readonly` **keyValueStorage**: `Keyv`\<`T`, [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `T`\>\>

#### Inherited from

`DenkmitDatabaseType.keyValueStorage`

***

### layers

> `readonly` **layers**: [`PollardInterface`](PollardInterface.md)[][]

#### Inherited from

`DenkmitDatabaseType.layers`

***

### manifest

> `readonly` **manifest**: [`ManifestInterface`](ManifestInterface.md)

#### Inherited from

`DenkmitDatabaseType.manifest`

***

### maxPollardLength

> `readonly` **maxPollardLength**: `number`

#### Inherited from

`DenkmitDatabaseType.maxPollardLength`

***

### order

> `readonly` **order**: `number`

#### Inherited from

`DenkmitDatabaseType.order`

## Methods

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Closes the database connection.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the connection is closed.

***

### compare()

> **compare**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

Compares the specified head with the current head in the database.

#### Parameters

• **head**: [`HeadInterface`](HeadInterface.md)

The head to compare.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

A promise that resolves with an object containing the comparison result.

##### difference

> **difference**: [[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]]

##### isEqual

> **isEqual**: `boolean`

***

### createHead()

> **createHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](HeadInterface.md)\>

Creates a new head for the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](HeadInterface.md)\>

A promise that resolves with the newly created head.

***

### fetchHead()

> **fetchHead**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](HeadInterface.md)\>

Fetches the head with the specified CID (Content Identifier) from the database.

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The CID of the head to fetch.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](HeadInterface.md)\>

A promise that resolves with the fetched head.

***

### get()

> **get**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

Retrieves the value associated with the specified key from the database.

#### Parameters

• **key**: `string`

The key to retrieve the value for.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

A promise that resolves with the retrieved value, or undefined if the key does not exist.

***

### getManifest()

> **getManifest**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](ManifestInterface.md)\>

Retrieves the manifest associated with the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](ManifestInterface.md)\>

A promise that resolves with the manifest.

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`string`, `T`], `any`, `unknown`\>

Returns an async generator that iterates over all key-value pairs in the database.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`string`, `T`], `any`, `unknown`\>

An async generator that yields key-value pairs.

***

### load()

> **load**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Loads the specified head into the database.

#### Parameters

• **head**: [`HeadInterface`](HeadInterface.md)

The head to load.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the head is loaded.

***

### merge()

> **merge**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Merges the specified head into the current head in the database.

#### Parameters

• **head**: [`HeadInterface`](HeadInterface.md)

The head to merge.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the merge is complete.

***

### set()

> **set**(`key`, `value`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Sets a value in the database with the specified key.

#### Parameters

• **key**: `string`

The key to set the value for.

• **value**: `T`

The value to set.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the value is set.
