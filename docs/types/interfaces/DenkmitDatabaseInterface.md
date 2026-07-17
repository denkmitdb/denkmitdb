[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / DenkmitDatabaseInterface

# Interface: DenkmitDatabaseInterface\<T\>

Represents the interface for the Denkmit database.

## Extends

- [`DenkmitDatabaseType`](../type-aliases/DenkmitDatabaseType.md)\<`T`\>

## Type Parameters

### T

`T`

The type of values stored in the database.

## Properties

### address

> `readonly` **address**: `CID`

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

> `readonly` **keyValueStorage**: `Keyv`\<`T`\>

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

***

### size

> `readonly` **size**: `number`

The number of records currently in the sorted index.

## Methods

### announceHead()

> **announceHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Re-announces the current head on the sync topic even when the root has not
changed, so peers that connected after the last change can converge.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves once the head (if any) has been published.

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Closes the database connection.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the connection is closed.

***

### compare()

> **compare**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

Compares the specified head with the current head in the database.

#### Parameters

##### head

[`HeadType`](../type-aliases/HeadType.md)

The head to compare.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

A promise that resolves with an object containing the comparison result.

***

### createHead()

> **createHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../type-aliases/HeadType.md)\>

Creates a new head for the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../type-aliases/HeadType.md)\>

A promise that resolves with the newly created head.

***

### delete()

> **delete**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Deletes a key by writing a signed tombstone. The tombstone participates in
the same last-write-wins order as puts: while it wins, the key is hidden from
`get`/`iterator`; a newer `set` resurrects it. The record remains in the
Merkle tree and replicates like any entry.

#### Parameters

##### key

`string`

The key to delete.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the tombstone is indexed.

***

### fetchHead()

> **fetchHead**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../type-aliases/HeadType.md)\>

Fetches the head with the specified CID (Content Identifier) from the database.

#### Parameters

##### cid

`CID`

The CID of the head to fetch.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../type-aliases/HeadType.md)\>

A promise that resolves with the fetched head.

***

### get()

> **get**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Retrieves the value associated with the specified key from the database.

#### Parameters

##### key

`string`

The key to retrieve the value for.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

A promise that resolves with the retrieved value, or undefined if the key does not exist.

***

### getManifest()

> **getManifest**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](ManifestInterface.md)\>

Retrieves the manifest associated with the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](ManifestInterface.md)\>

A promise that resolves with the manifest.

***

### idle()

> **idle**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Resolves once queued background work (tree rebuilds, merges) has drained.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the sync task queue is idle.

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`string`, `T`\]\>

Returns an async generator that iterates over all key-value pairs in the database.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`string`, `T`\]\>

An async generator that yields key-value pairs.

***

### load()

> **load**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Loads the specified head into the database.

#### Parameters

##### head

[`HeadType`](../type-aliases/HeadType.md)

The head to load.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the head is loaded.

***

### merge()

> **merge**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Merges the specified head into the current head in the database.

#### Parameters

##### head

[`HeadType`](../type-aliases/HeadType.md)

The head to merge.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the merge is complete.

***

### sendHead()

> **sendHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Publishes the current head (if the root changed) on the sync topic.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves once the head has been handed to the sync controller.

***

### set()

> **set**(`key`, `value`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Sets a value in the database with the specified key.

#### Parameters

##### key

`string`

The key to set the value for.

##### value

`T`

The value to set.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the value is set.

***

### syncNewHead()

> **syncNewHead**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Handles an incoming head announcement (the encoded CID of a peer's head),
queuing a load or merge of that head into this database.

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The encoded CID bytes received on the sync topic.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves once the task has been enqueued.
