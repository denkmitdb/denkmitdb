[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / HeliaControllerInterface

# Interface: HeliaControllerInterface

## Extends

- [`HeliaStorageInterface`](HeliaStorageInterface.md)

## Properties

### datastore

> `readonly` **datastore**: `Datastore`

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`datastore`](HeliaStorageInterface.md#datastore)

***

### helia

> `readonly` **helia**: [`DenkmitHeliaInterface`](../type-aliases/DenkmitHeliaInterface.md)

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`helia`](HeliaStorageInterface.md#helia)

***

### identity

> **identity**: [`IdentityInterface`](IdentityInterface.md)

***

### libp2p

> `readonly` **libp2p**: [`DenkmitLibp2pType`](../type-aliases/DenkmitLibp2pType.md)

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`libp2p`](HeliaStorageInterface.md#libp2p)

## Methods

### add()

> **add**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

##### data

`unknown`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`add`](HeliaStorageInterface.md#add)

***

### addSigned()

> **addSigned**\<`T`\>(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../type-aliases/DenkmitData.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`T`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../type-aliases/DenkmitData.md)\<`T`\>\>

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`close`](HeliaStorageInterface.md#close)

***

### get()

> **get**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### cid

`CID`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`get`](HeliaStorageInterface.md#get)

***

### getSigned()

> **getSigned**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../type-aliases/DenkmitData.md)\<`T`\> \| `undefined`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### cid

`CID`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`DenkmitData`](../type-aliases/DenkmitData.md)\<`T`\> \| `undefined`\>

***

### pin()

> **pin**(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### cid

`CID`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Inherited from

[`HeliaStorageInterface`](HeliaStorageInterface.md).[`pin`](HeliaStorageInterface.md#pin)
