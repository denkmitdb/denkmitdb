[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / HeliaStorageInterface

# Interface: HeliaStorageInterface

## Extended by

- [`HeliaControllerInterface`](HeliaControllerInterface.md)

## Properties

### datastore

> `readonly` **datastore**: `Datastore`\<`object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`, `object`\>

***

### helia

> `readonly` **helia**: [`DenkmitHeliaInterface`](../type-aliases/DenkmitHeliaInterface.md)

***

### libp2p

> `readonly` **libp2p**: [`DenkmitLibp2pType`](../type-aliases/DenkmitLibp2pType.md)

## Methods

### add()

> **add**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

• **data**: `unknown`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### get()

> **get**\<`T`\>(`cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>

#### Type parameters

• **T**

#### Parameters

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| `T`\>
