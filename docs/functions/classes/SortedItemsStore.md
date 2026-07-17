[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / SortedItemsStore

# Class: SortedItemsStore

## Implements

- [`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md)

## Constructors

### Constructor

> **new SortedItemsStore**(): `SortedItemsStore`

#### Returns

`SortedItemsStore`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`size`](../../types/interfaces/SortedItemsStoreInterface.md#size)

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

The index of the first record whose composite key is at or after
`sortField` (interpreted as a timestamp lower bound). Used to locate where a
tree rebuild must start. Returns `size` when nothing is at or after it.

#### Parameters

##### sortField

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`find`](../../types/interfaces/SortedItemsStoreInterface.md#find)

***

### getByIndex()

> **getByIndex**(`index`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Parameters

##### index

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`getByIndex`](../../types/interfaces/SortedItemsStoreInterface.md#getbyindex)

***

### getByKey()

> **getByKey**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md) \| `undefined`\>

#### Parameters

##### key

`string`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md) \| `undefined`\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`getByKey`](../../types/interfaces/SortedItemsStoreInterface.md#getbykey)

***

### iterator()

> **iterator**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`iterator`](../../types/interfaces/SortedItemsStoreInterface.md#iterator)

***

### iteratorFromIndex()

> **iteratorFromIndex**(`startIndex`): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

Iterates records in composite-key order starting at position `startIndex`.

#### Parameters

##### startIndex

`number`

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<[`SortedItemType`](../../types/type-aliases/SortedItemType.md)\>

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`iteratorFromIndex`](../../types/interfaces/SortedItemsStoreInterface.md#iteratorfromindex)

***

### set()

> **set**(`sortField`, `key`, `cid`, `creator`, `deleted?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SetResult`](../../types/type-aliases/SetResult.md)\>

Inserts a record for `key`, resolving conflicts by last-write-wins on the
composite key (KNOWN_ISSUES.md #2). The winner is the record with the
greatest `(timestamp, cid)`.

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

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SetResult`](../../types/type-aliases/SetResult.md)\>

`applied` — whether this record is now the live record for `key`.
  When it wins over a previous record, `previousTimestamp` carries that
  record's timestamp so callers can rebuild the tree from the earlier of
  the two positions.

#### Implementation of

[`SortedItemsStoreInterface`](../../types/interfaces/SortedItemsStoreInterface.md).[`set`](../../types/interfaces/SortedItemsStoreInterface.md#set)
