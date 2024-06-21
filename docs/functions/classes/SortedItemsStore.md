[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / SortedItemsStore

# Class: SortedItemsStore

## Implements

- [`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md)

## Constructors

### new SortedItemsStore()

> **new SortedItemsStore**(): [`SortedItemsStore`](SortedItemsStore.md)

#### Returns

[`SortedItemsStore`](SortedItemsStore.md)

## Accessors

### size

> `get` **size**(): `number`

#### Returns

`number`

## Methods

### clear()

> **clear**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`clear`](../../types/interfaces/SortedItemsStoreInterface.md#clear)

***

### find()

> **find**(`sortField`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Parameters

• **sortField**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`find`](../../types/interfaces/SortedItemsStoreInterface.md#find)

***

### findPrevious()

> **findPrevious**(`sortField`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Parameters

• **sortField**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`findPrevious`](../../types/interfaces/SortedItemsStoreInterface.md#findprevious)

***

### getByIndex()

> **getByIndex**(`index`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Parameters

• **index**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`getByIndex`](../../types/interfaces/SortedItemsStoreInterface.md#getbyindex)

***

### getByKey()

> **getByKey**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Parameters

• **key**: `string`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`getByKey`](../../types/interfaces/SortedItemsStoreInterface.md#getbykey)

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md), `any`, `unknown`\>

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md), `any`, `unknown`\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`iterator`](../../types/interfaces/SortedItemsStoreInterface.md#iterator)

***

### iteratorFrom()

> **iteratorFrom**(`sortField`): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md), `any`, `unknown`\>

#### Parameters

• **sortField**: `number`

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md), `any`, `unknown`\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`iteratorFrom`](../../types/interfaces/SortedItemsStoreInterface.md#iteratorfrom)

***

### set()

> **set**(`sortField`, `key`, `cid`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **sortField**: `number`

• **key**: `string`

• **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`set`](../../types/interfaces/SortedItemsStoreInterface.md#set)
