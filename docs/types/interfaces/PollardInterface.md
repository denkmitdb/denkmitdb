[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / PollardInterface

# Interface: PollardInterface

## Extends

- [`PollardType`](../type-aliases/PollardType.md)

## Properties

### cid

> `readonly` **cid**: `CID`

#### Inherited from

`PollardType.cid`

***

### layers

> `readonly` **layers**: [`LeafType`](../type-aliases/LeafType.md)[][]

#### Inherited from

`PollardType.layers`

***

### length

> `readonly` **length**: `number`

#### Inherited from

`PollardType.length`

***

### maxLength

> `readonly` **maxLength**: `number`

#### Inherited from

`PollardType.maxLength`

***

### order

> `readonly` **order**: `number`

#### Inherited from

`PollardType.order`

***

### version

> `readonly` **version**: `2`

#### Inherited from

`PollardType.version`

## Methods

### addLeaf()

> **addLeaf**(`leaf`): `boolean`

#### Parameters

##### leaf

[`LeafType`](../type-aliases/LeafType.md)

#### Returns

`boolean`

***

### all()

> **all**(): [`LeafType`](../type-aliases/LeafType.md)[]

#### Returns

[`LeafType`](../type-aliases/LeafType.md)[]

***

### append()

#### Call Signature

> **append**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`Empty`](../enumerations/LeafTypes.md#empty)

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`, `data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`Hash`](../enumerations/LeafTypes.md#hash)

###### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`, `data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`Pollard`](../enumerations/LeafTypes.md#pollard)

###### data

`CID`

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`, `data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`Identity`](../enumerations/LeafTypes.md#identity)

###### data

`CID`

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`, `data`, `creator`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`Entry`](../enumerations/LeafTypes.md#entry)

###### data

`CID`

###### creator

`CID`

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Call Signature

> **append**(`type`, `data`, `creator`, `sort`, `key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

##### Parameters

###### type

[`SortedEntry`](../enumerations/LeafTypes.md#sortedentry)

###### data

`CID`

###### creator

`CID`

###### sort

`number`[]

###### key

`string`

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

***

### compare()

> **compare**(`other?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

#### Parameters

##### other?

`PollardInterface`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `difference`: \[[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]\]; `isEqual`: `boolean`; \}\>

***

### getCID()

> **getCID**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

***

### getLayers()

> **getLayers**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)[][]\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)[][]\>

***

### getLeaf()

> **getLeaf**(`index`): [`LeafType`](../type-aliases/LeafType.md)

#### Parameters

##### index

`number`

#### Returns

[`LeafType`](../type-aliases/LeafType.md)

***

### getNode()

> **getNode**(`layer`, `index`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)\>

#### Parameters

##### layer

`number`

##### index

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)\>

***

### getRoot()

> **getRoot**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)\>

***

### isFree()

> **isFree**(): `boolean`

#### Returns

`boolean`

***

### iterator()

> **iterator**(): [`Generator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator)\<[`LeafType`](../type-aliases/LeafType.md)\>

#### Returns

[`Generator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator)\<[`LeafType`](../type-aliases/LeafType.md)\>

***

### toJSON()

> **toJSON**(): [`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`PollardType`](../type-aliases/PollardType.md), `"cid"`\>

#### Returns

[`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`PollardType`](../type-aliases/PollardType.md), `"cid"`\>

***

### updateLayers()

> **updateLayers**(`startPosition?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

##### startPosition?

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>
