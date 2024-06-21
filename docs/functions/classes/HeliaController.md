[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / HeliaController

# Class: HeliaController

Represents a controller for interacting with the Helia storage, providing methods for adding and retrieving signed data.

## Extends

- [`HeliaStorage`](HeliaStorage.md)

## Implements

- [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

## Constructors

### new HeliaController()

> **new HeliaController**(`helia`, `identity`): [`HeliaController`](HeliaController.md)

#### Parameters

• **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

• **identity**: [`IdentityInterface`](../../types/interfaces/IdentityInterface.md)

#### Returns

[`HeliaController`](HeliaController.md)

#### Overrides

[`HeliaStorage`](HeliaStorage.md).[`constructor`](HeliaStorage.md#constructors)

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

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`decode`](HeliaStorage.md#decode)

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

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`encode`](HeliaStorage.md#encode)

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

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`add`](../../types/interfaces/HeliaControllerInterface.md#add)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`add`](HeliaStorage.md#add)

***

### addBytes()

> **addBytes**(`buf`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

• **buf**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`addBytes`](HeliaStorage.md#addbytes)

***

### addSigned()

> **addSigned**\<`T`\>(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

Adds the signed data to the database.

#### Type parameters

• **T**

#### Parameters

• **data**: [`OwnedDataType`](../../types/type-aliases/OwnedDataType.md)\<`T`\>

The data to be added, along with the identity used for signing.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

The CID (Content Identifier) of the added data.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`addSigned`](../../types/interfaces/HeliaControllerInterface.md#addsigned)

#### Throws

Error if the identity is not provided.

***

### addSignedV2()

> **addSignedV2**\<`T`\>(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

#### Type parameters

• **T**

#### Parameters

• **data**: `T`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`addSignedV2`](../../types/interfaces/HeliaControllerInterface.md#addsignedv2)

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

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`get`](../../types/interfaces/HeliaControllerInterface.md#get)

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`get`](HeliaStorage.md#get)

***

### getBytes()

> **getBytes**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

#### Inherited from

[`HeliaStorage`](HeliaStorage.md).[`getBytes`](HeliaStorage.md#getbytes)

***

### getSigned()

> **getSigned**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`OwnedDataType`](../../types/type-aliases/OwnedDataType.md)\<`T`\>\>

Retrieves a signed data object of type T from the specified CID.

#### Type parameters

• **T**

The type of the data object.

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

The CID of the data object.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`OwnedDataType`](../../types/type-aliases/OwnedDataType.md)\<`T`\>\>

A promise that resolves to the signed data object, or undefined if it doesn't exist or fails verification.

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`getSigned`](../../types/interfaces/HeliaControllerInterface.md#getsigned)

***

### getSignedV2()

> **getSignedV2**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

#### Type parameters

• **T**

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<`T`\>\>

#### Implementation of

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md).[`getSignedV2`](../../types/interfaces/HeliaControllerInterface.md#getsignedv2)
