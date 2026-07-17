[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / SortedItemsStoreInterface

# Interface: SortedItemsStoreInterface

## Properties

### size

> `readonly` **size**: `number`

## Methods

### clear()

> **clear**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### find()

> **find**(`sortField`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

#### Parameters

##### sortField

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

***

### getByIndex()

> **getByIndex**(`index`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

#### Parameters

##### index

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

***

### getByKey()

> **getByKey**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md) \| `undefined`\>

#### Parameters

##### key

`string`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../type-aliases/SortedItemType.md) \| `undefined`\>

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

***

### iteratorFromIndex()

> **iteratorFromIndex**(`startIndex`): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

#### Parameters

##### startIndex

`number`

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../type-aliases/SortedItemType.md)\>

***

### set()

> **set**(`sortField`, `key`, `cid`, `creator`, `deleted?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SetResult`](../type-aliases/SetResult.md)\>

#### Parameters

##### sortField

`number`

##### key

`string`

##### cid

`CID`

##### creator

`CID`

##### deleted?

`boolean`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SetResult`](../type-aliases/SetResult.md)\>
