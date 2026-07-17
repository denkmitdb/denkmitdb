[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / DenkmitDatabase

# Class: DenkmitDatabase\<T\>

Represents a Denkmit Database.

## Type Parameters

### T

`T`

The type of values stored in the database.

## Implements

- [`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>

## Constructors

### Constructor

> **new DenkmitDatabase**\<`T`\>(`mdb`): `DenkmitDatabase`\<`T`\>

#### Parameters

##### mdb

[`DenkmitDatabaseInput`](../../types/type-aliases/DenkmitDatabaseInput.md)\<`T`\>

#### Returns

`DenkmitDatabase`\<`T`\>

## Properties

### heliaController

> `readonly` **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`heliaController`](../../types/interfaces/DenkmitDatabaseInterface.md#heliacontroller)

***

### keyValueStorage

> `readonly` **keyValueStorage**: `Keyv`\<`T`\>

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`keyValueStorage`](../../types/interfaces/DenkmitDatabaseInterface.md#keyvaluestorage)

***

### layers

> `readonly` **layers**: [`PollardInterface`](../../types/interfaces/PollardInterface.md)[][]

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`layers`](../../types/interfaces/DenkmitDatabaseInterface.md#layers)

***

### manifest

> `readonly` **manifest**: [`ManifestInterface`](../../types/interfaces/ManifestInterface.md)

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`manifest`](../../types/interfaces/DenkmitDatabaseInterface.md#manifest)

***

### maxPollardLength

> `readonly` **maxPollardLength**: `number`

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`maxPollardLength`](../../types/interfaces/DenkmitDatabaseInterface.md#maxpollardlength)

## Accessors

### address

#### Get Signature

> **get** **address**(): `CID`

Gets the address of the denkmitdb.

##### Returns

`CID`

The CID (Content Identifier) of the denkmitdb.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`address`](../../types/interfaces/DenkmitDatabaseInterface.md#address)

***

### identity

#### Get Signature

> **get** **identity**(): [`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

##### Returns

[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`identity`](../../types/interfaces/DenkmitDatabaseInterface.md#identity)

***

### order

#### Get Signature

> **get** **order**(): `number`

Gets the pollard order in the database.

##### Returns

`number`

The pollard order.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`order`](../../types/interfaces/DenkmitDatabaseInterface.md#order)

***

### size

#### Get Signature

> **get** **size**(): `number`

The number of records currently in the sorted index.

##### Returns

`number`

The number of records currently in the sorted index.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`size`](../../types/interfaces/DenkmitDatabaseInterface.md#size)

## Methods

### announceHead()

> **announceHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Re-announces the current head on the sync topic even when the root has not
changed. `sendHead()` only publishes on a root change, so a peer that connects
after the last change-triggered announcement would otherwise never learn the
head (KNOWN_ISSUES.md #21). Builds a head first if one exists but hasn't been
created yet; no-op for an empty database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves once the head (if any) has been published.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`announceHead`](../../types/interfaces/DenkmitDatabaseInterface.md#announcehead)

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Closes the DenkmitDB instance.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the DenkmitDB instance is closed.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`close`](../../types/interfaces/DenkmitDatabaseInterface.md#close)

***

### compare()

> **compare**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../../types/type-aliases/LeafType.md)[], [`LeafType`](../../types/type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

Compares the specified head with the current head in the database.

#### Parameters

##### head

[`HeadType`](../../types/type-aliases/HeadType.md)

The head to compare.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../../types/type-aliases/LeafType.md)[], [`LeafType`](../../types/type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

A promise that resolves with an object containing the comparison result.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`compare`](../../types/interfaces/DenkmitDatabaseInterface.md#compare)

***

### createHead()

> **createHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md)\>

Creates a new head for the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md)\>

A promise that resolves with the newly created head.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`createHead`](../../types/interfaces/DenkmitDatabaseInterface.md#createhead)

***

### createOnlyNewHead()

> **createOnlyNewHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md) \| `undefined`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md) \| `undefined`\>

***

### createTaskUpdateLayers()

> **createTaskUpdateLayers**(`sortKey`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### sortKey

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### delete()

> **delete**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Deletes a key by writing a signed tombstone (specs/ordering.md): the tombstone
participates in the same composite last-write-wins order as puts, hides the
key from `get`/`iterator` while it wins, and a newer `set` resurrects the key.
The record remains in the Merkle tree and replicates like any entry; no block
garbage collection is performed.

#### Parameters

##### key

`string`

The key to delete.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the tombstone is indexed.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`delete`](../../types/interfaces/DenkmitDatabaseInterface.md#delete)

***

### fetchHead()

> **fetchHead**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md)\>

Fetches the head with the specified CID (Content Identifier) from the database.

#### Parameters

##### cid

`CID`

The CID of the head to fetch.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadType`](../../types/type-aliases/HeadType.md)\>

A promise that resolves with the fetched head.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`fetchHead`](../../types/interfaces/DenkmitDatabaseInterface.md#fetchhead)

***

### get()

> **get**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Retrieves the value associated with the specified key.
If the value is found in the key-value storage, it is returned.
Otherwise, it retrieves the item from the sorted items store,
fetches the entry using the CID, and stores the entry in the key-value storage.
Finally, it returns the retrieved value.

#### Parameters

##### key

`string`

The key to retrieve the value for.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

The value associated with the key, or undefined if not found.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`get`](../../types/interfaces/DenkmitDatabaseInterface.md#get)

***

### getCID()

> **getCID**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

***

### getLayers()

> **getLayers**(): [`PollardInterface`](../../types/interfaces/PollardInterface.md)[][]

#### Returns

[`PollardInterface`](../../types/interfaces/PollardInterface.md)[][]

***

### getManifest()

> **getManifest**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](../../types/interfaces/ManifestInterface.md)\>

Retrieves the manifest associated with the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ManifestInterface`](../../types/interfaces/ManifestInterface.md)\>

A promise that resolves with the manifest.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`getManifest`](../../types/interfaces/DenkmitDatabaseInterface.md#getmanifest)

***

### getPollardTreeNode()

> **getPollardTreeNode**(`__namedParameters`): [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Parameters

##### \_\_namedParameters

[`PollardLocation`](../../types/type-aliases/PollardLocation.md)

#### Returns

[`PollardNode`](../../types/type-aliases/PollardNode.md)

***

### idle()

> **idle**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Resolves once queued background work (tree rebuilds, merges) has drained.
Writes are indexed synchronously, but the Merkle tree is rebuilt on the sync
queue; await this to observe a settled tree/head after `set` or a merge.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`idle`](../../types/interfaces/DenkmitDatabaseInterface.md#idle)

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`string`, `T`\]\>

Returns an async iterator that yields key-value pairs from the DenkmitDB instance.
The key-value pairs are retrieved from the sortedItemsStore and filtered based on the availability of the value.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`string`, `T`\]\>

An async generator that yields key-value pairs.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`iterator`](../../types/interfaces/DenkmitDatabaseInterface.md#iterator)

***

### load()

> **load**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Loads the data from the given head into the database.

#### Parameters

##### head

[`HeadType`](../../types/type-aliases/HeadType.md)

The head interface containing the root bytes.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the loading is complete.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`load`](../../types/interfaces/DenkmitDatabaseInterface.md#load)

***

### merge()

> **merge**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Merges the provided `head` with the current state of the database.
If the `head` is equal to the current state, no merge is performed.
Otherwise, the method compares the `head` with the current state,
extracts the smallest timestamp from the differing sorted entries,
and creates a task to update the layers based on the smallest timestamp.

#### Parameters

##### head

[`HeadType`](../../types/type-aliases/HeadType.md)

The head to be merged with the current state of the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the merge operation is completed.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`merge`](../../types/interfaces/DenkmitDatabaseInterface.md#merge)

***

### sendHead()

> **sendHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Publishes the current head (if the root changed) on the sync topic.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves once the head has been handed to the sync controller.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`sendHead`](../../types/interfaces/DenkmitDatabaseInterface.md#sendhead)

***

### set()

> **set**(`key`, `value`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Sets the value of a key in the database.

#### Parameters

##### key

`string`

The key to set.

##### value

`T`

The value to set for the key.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the operation is complete.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`set`](../../types/interfaces/DenkmitDatabaseInterface.md#set)

***

### setPollardTreeNode()

> **setPollardTreeNode**(`node`): `void`

#### Parameters

##### node

[`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Returns

`void`

***

### setupSync()

> **setupSync**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Sets up the synchronization process.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A Promise that resolves when the setup is complete.

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

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`syncNewHead`](../../types/interfaces/DenkmitDatabaseInterface.md#syncnewhead)

***

### updateLayers()

> **updateLayers**(`sortKey`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### sortKey

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
