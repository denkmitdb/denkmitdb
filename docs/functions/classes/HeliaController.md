[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / HeliaController

# Class: HeliaController

Represents a controller for interacting with the Helia storage, providing methods for adding and retrieving signed data.

## Extends

- [`HeliaStorage`](HeliaStorage.md)

## Implements

- [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

## Constructors

### Constructor

> **new HeliaController**(`helia`, `identity`): `HeliaController`

#### Parameters

##### helia

[`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

##### identity

[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

#### Returns

`HeliaController`

#### Overrides

[`HeliaStorage`](HeliaStorage.md).[`constructor`](HeliaStorage.md#constructor)

## Properties

### helia

> `readonly` **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`helia`](../../types/interfaces/HeliaControllerInterface.md#helia)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`helia`](HeliaStorage.md#helia)

***

### identity

> `readonly` **identity**: [`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`identity`](../../types/interfaces/HeliaControllerInterface.md#identity)

## Accessors

### code

#### Get Signature

> **get** `static` **code**(): `number`

##### Returns

`number`

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`code`](HeliaStorage.md#code)

***

### blockstore

#### Get Signature

> **get** **blockstore**(): `Blocks`

Gets the blockstore.

##### Returns

`Blocks`

The blockstore.

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`blockstore`](HeliaStorage.md#blockstore)

***

### datastore

#### Get Signature

> **get** **datastore**(): `Datastore`\<\{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}\>

Gets the datastore.

##### Returns

`Datastore`\<\{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}\>

The datastore.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`datastore`](../../types/interfaces/HeliaControllerInterface.md#datastore)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`datastore`](HeliaStorage.md#datastore)

***

### identityFetchCount

#### Get Signature

> **get** **identityFetchCount**(): `number`

Count of identities actually fetched+verified (cache misses).

##### Returns

`number`

***

### libp2p

#### Get Signature

> **get** **libp2p**(): [`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

Gets the libp2p instance.

##### Returns

[`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

The libp2p instance.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`libp2p`](../../types/interfaces/HeliaControllerInterface.md#libp2p)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`libp2p`](HeliaStorage.md#libp2p)

***

### logger

#### Get Signature

> **get** **logger**(): `ComponentLogger`

Gets the logger instance.

##### Returns

`ComponentLogger`

The logger instance.

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`logger`](HeliaStorage.md#logger)

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

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`decode`](HeliaStorage.md#decode)

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

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`encode`](HeliaStorage.md#encode)

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

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`add`](../../types/interfaces/HeliaControllerInterface.md#add)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`add`](HeliaStorage.md#add)

***

### addSigned()

> **addSigned**\<`T`\>(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

Signs `data` with the local identity and stores the JWS as a dag-cbor block.

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`T`

The payload to sign and store.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

The stored payload with its CID and the signer's identity CID.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`addSigned`](../../types/interfaces/HeliaControllerInterface.md#addsigned)

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Closes the HeliaStorage instance.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

A Promise that resolves when the controller is closed.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`close`](../../types/interfaces/HeliaControllerInterface.md#close)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`close`](HeliaStorage.md#close)

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

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`get`](../../types/interfaces/HeliaControllerInterface.md#get)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`get`](HeliaStorage.md#get)

***

### getSigned()

> **getSigned**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\> \| `undefined`\>

Fetches a JWS block, resolves and verifies the signer's identity (cached),
and returns the decoded payload with its provenance.

#### Type Parameters

##### T

`T`

The type of the decoded payload.

#### Parameters

##### cid

`CID`

The CID of the signed block.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\> \| `undefined`\>

The payload with CID and creator, or undefined if missing or invalid.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`getSigned`](../../types/interfaces/HeliaControllerInterface.md#getsigned)

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

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`pin`](../../types/interfaces/HeliaControllerInterface.md#pin)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`pin`](HeliaStorage.md#pin)
