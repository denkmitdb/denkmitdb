[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / HeliaStorage

# Class: HeliaStorage

Represents a Storage for interacting with the Helia IPFS.

## Extended by

- [`HeliaController`](HeliaController.md)

## Implements

- [`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md)

## Constructors

### new HeliaStorage()

> **new HeliaStorage**(`helia`): [`HeliaStorage`](HeliaStorage.md)

Creates a new instance of the HeliaStorage class.

#### Parameters

• **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

The Helia database interface.

#### Returns

[`HeliaStorage`](HeliaStorage.md)

## Properties

### helia

> `readonly` **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`helia`](../../types/interfaces/HeliaStorageInterface.md#helia)

## Accessors

### code

> `get` `static` **code**(): `number`

#### Returns

`number`

***

### blockstore

> `get` **blockstore**(): `Blocks`

Gets the blockstore.

#### Returns

`Blocks`

The blockstore.

***

### datastore

> `get` **datastore**(): `Datastore`\<`object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`\>

Gets the datastore.

#### Returns

`Datastore`\<`object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`\>

The datastore.

***

### libp2p

> `get` **libp2p**(): [`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

Gets the libp2p instance.

#### Returns

[`DenkmitLibp2pType`](../../types/type-aliases/DenkmitLibp2pType.md)

The libp2p instance.

## Methods

### decode()

> `static` **decode**\<`T`\>(`data`): `T`

Decodes the given Uint8Array data using the specified codec.

#### Type parameters

• **T**

The type of the decoded data.

#### Parameters

• **data**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The data to be decoded.

#### Returns

`T`

The decoded data.

***

### encode()

> `static` **encode**\<`T`\>(`data`): [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

Encodes the given data into a Uint8Array.

#### Type parameters

• **T**

#### Parameters

• **data**: `T`

The data to be encoded.

#### Returns

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

The encoded data as a Uint8Array.

***

### add()

> **add**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

Adds an object to the Helia database.

#### Parameters

• **data**: `unknown`

The object to add.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

A Promise that resolves to the CID of the added object.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`add`](../../types/interfaces/HeliaStorageInterface.md#add)

***

### addBytes()

> **addBytes**(`buf`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

• **buf**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

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

> **get**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

Retrieves an object from the Helia database.

#### Type parameters

• **T**

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The CID of the object to retrieve.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

A Promise that resolves to the retrieved object, or undefined if not found.

#### Implementation of

[`HeliaStorageInterface`](../../types/interfaces/HeliaStorageInterface.md).[`get`](../../types/interfaces/HeliaStorageInterface.md#get)

***

### getBytes()

> **getBytes**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>
