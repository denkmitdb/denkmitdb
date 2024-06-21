[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / DenkmitDatabase

# Class: DenkmitDatabase\<T\>

Represents a Denkmit Database.

## Type parameters

• **T**

The type of values stored in the database.

## Implements

- [`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md)\<`T`\>

## Constructors

### new DenkmitDatabase()

> **new DenkmitDatabase**\<`T`\>(`mdb`): [`DenkmitDatabase`](DenkmitDatabase.md)\<`T`\>

#### Parameters

• **mdb**: [`DenkmitDatabaseInput`](../../types/type-aliases/DenkmitDatabaseInput.md)\<`T`\>

#### Returns

[`DenkmitDatabase`](DenkmitDatabase.md)\<`T`\>

## Properties

### heliaController

> `readonly` **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`heliaController`](../../types/interfaces/DenkmitDatabaseInterface.md#heliacontroller)

***

### keyValueStorage

> `readonly` **keyValueStorage**: `Keyv`\<`T`, [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `T`\>\>

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

> `get` **address**(): `CID`\<`unknown`, `number`, `number`, `Version`\>

Gets the address of the denkmitdb.

#### Returns

`CID`\<`unknown`, `number`, `number`, `Version`\>

The CID (Content Identifier) of the denkmitdb.

***

### identity

> `get` **identity**(): [`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

#### Returns

[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

***

### order

> `get` **order**(): `number`

Gets the pollard order in the database.

#### Returns

`number`

The pollard order.

***

### size

> `get` **size**(): `number`

#### Returns

`number`

## Methods

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

> **compare**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

Compares the specified head with the current head in the database.

#### Parameters

• **head**: [`HeadInterface`](../../types/interfaces/HeadInterface.md)

The head to compare.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

A promise that resolves with an object containing the comparison result.

##### difference

> **difference**: [[`LeafType`](../../types/type-aliases/LeafType.md)[], [`LeafType`](../../types/type-aliases/LeafType.md)[]]

##### isEqual

> **isEqual**: `boolean`

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`compare`](../../types/interfaces/DenkmitDatabaseInterface.md#compare)

***

### createHead()

> **createHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

Creates a new head for the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

A promise that resolves with the newly created head.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`createHead`](../../types/interfaces/DenkmitDatabaseInterface.md#createhead)

***

### createOnlyNewHead()

> **createOnlyNewHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

***

### createTaskUpdateLayers()

> **createTaskUpdateLayers**(`sortKey`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **sortKey**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### fetchHead()

> **fetchHead**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

Fetches the head with the specified CID (Content Identifier) from the database.

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The CID of the head to fetch.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`HeadInterface`](../../types/interfaces/HeadInterface.md)\>

A promise that resolves with the fetched head.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`fetchHead`](../../types/interfaces/DenkmitDatabaseInterface.md#fetchhead)

***

### get()

> **get**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

Retrieves the value associated with the specified key.
If the value is found in the key-value storage, it is returned.
Otherwise, it retrieves the item from the sorted items store,
fetches the entry using the CID, and stores the entry in the key-value storage.
Finally, it returns the retrieved value.

#### Parameters

• **key**: `string`

The key to retrieve the value for.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

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

• **\_\_namedParameters**: [`PollardLocation`](../../types/type-aliases/PollardLocation.md)

#### Returns

[`PollardNode`](../../types/type-aliases/PollardNode.md)

***

### getPollardTreeNodeChildren()

> **getPollardTreeNodeChildren**(`node`): [`PollardNode`](../../types/type-aliases/PollardNode.md)[]

#### Parameters

• **node**: [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Returns

[`PollardNode`](../../types/type-aliases/PollardNode.md)[]

***

### getPollardTreeNodeLeft()

> **getPollardTreeNodeLeft**(`node`): [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Parameters

• **node**: [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Returns

[`PollardNode`](../../types/type-aliases/PollardNode.md)

***

### getPollardTreeNodeParent()

> **getPollardTreeNodeParent**(`node`): [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Parameters

• **node**: [`PollardNode`](../../types/type-aliases/PollardNode.md)

#### Returns

[`PollardNode`](../../types/type-aliases/PollardNode.md)

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`string`, `T`], `any`, `unknown`\>

Returns an async iterator that yields key-value pairs from the DenkmitDB instance.
The key-value pairs are retrieved from the sortedItemsStore and filtered based on the availability of the value.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`string`, `T`], `any`, `unknown`\>

An async generator that yields key-value pairs.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`iterator`](../../types/interfaces/DenkmitDatabaseInterface.md#iterator)

***

### load()

> **load**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Loads the data from the given head into the database.

#### Parameters

• **head**: [`HeadInterface`](../../types/interfaces/HeadInterface.md)

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

• **head**: [`HeadInterface`](../../types/interfaces/HeadInterface.md)

The head to be merged with the current state of the database.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A promise that resolves when the merge operation is completed.

#### Implementation of

[`DenkmitDatabaseInterface`](../../types/interfaces/DenkmitDatabaseInterface.md).[`merge`](../../types/interfaces/DenkmitDatabaseInterface.md#merge)

***

### sendHead()

> **sendHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### set()

> **set**(`key`, `value`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Sets the value of a key in the database.

#### Parameters

• **key**: `string`

The key to set.

• **value**: `T`

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

• **node**: [`PollardNode`](../../types/type-aliases/PollardNode.md)

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

> **syncNewHead**(`message`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **message**: [`CustomEvent`](https://developer.mozilla.org/docs/Web/API/CustomEvent)\<`Message`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### updateLayers()

> **updateLayers**(`sortKey`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **sortKey**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
