[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / HeliaStorage

# Class: HeliaStorage

Represents a Storage for interacting with the Helia IPFS.

## Extended by

- [`HeliaController`](HeliaController.md)

## Implements

- [`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md)

## Constructors

### Constructor

> **new HeliaStorage**(`helia`): `HeliaStorage`

Creates a new instance of the HeliaStorage class.

#### Parameters

##### helia

[`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

The Helia database interface.

#### Returns

`HeliaStorage`

## Properties

### helia

> `readonly` **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`helia`](../../types/interfaces/HeliaStorageInterface.md#helia)

## Accessors

### code

#### Get Signature

> **get** `static` **code**(): `number`

##### Returns

`number`

***

### blockstore

#### Get Signature

> **get** **blockstore**(): `Blocks`

Gets the blockstore.

##### Returns

`Blocks`

The blockstore.

***

### datastore

#### Get Signature

> **get** **datastore**(): `Datastore`\<\{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}\>

Gets the datastore.

##### Returns

`Datastore`\<\{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}\>

The datastore.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`datastore`](../../types/interfaces/HeliaStorageInterface.md#datastore)

***

### libp2p

#### Get Signature

> **get** **libp2p**(): [`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

Gets the libp2p instance.

##### Returns

[`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

The libp2p instance.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`libp2p`](../../types/interfaces/HeliaStorageInterface.md#libp2p)

***

### logger

#### Get Signature

> **get** **logger**(): `ComponentLogger`

Gets the logger instance.

##### Returns

`ComponentLogger`

The logger instance.

## Methods

### decode()

> `static` **decode**\<`T`\>(`data`): `T`

Decodes the given Uint8Array data using the specified codec.

#### Type Parameters

##### T

`T`

The type of the decoded data.

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The data to be decoded.

#### Returns

`T`

The decoded data.

***

### encode()

> `static` **encode**\<`T`\>(`data`): [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

Encodes the given data into a Uint8Array.

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`T`

The data to be encoded.

#### Returns

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The encoded data as a Uint8Array.

***

### add()

> **add**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

Adds an object to the Helia database.

#### Parameters

##### data

`unknown`

The object to add.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

A Promise that resolves to the CID of the added object.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`add`](../../types/interfaces/HeliaStorageInterface.md#add)

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Closes the HeliaStorage instance.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A Promise that resolves when the controller is closed.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`close`](../../types/interfaces/HeliaStorageInterface.md#close)

***

### get()

> **get**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Retrieves an object from the Helia database.

#### Type Parameters

##### T

`T`

#### Parameters

##### cid

`CID`

The CID of the object to retrieve.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

A Promise that resolves to the retrieved object, or undefined if not found.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`get`](../../types/interfaces/HeliaStorageInterface.md#get)

***

### pin()

> **pin**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Pins a block so Helia garbage collection cannot drop it. Used for foreign
blocks (entries, identities) accepted during merge — they were fetched, not
added, so they are unpinned by default and a locally persisted head would not
survive GC without this (KNOWN_ISSUES.md D4).

#### Parameters

##### cid

`CID`

The CID of the block to pin.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`pin`](../../types/interfaces/HeliaStorageInterface.md#pin)
