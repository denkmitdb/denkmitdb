[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / PollardInterface

# Interface: PollardInterface

## Extends

- [`PollardType`](../type-aliases/PollardType.md)

## Properties

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

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

> `readonly` **version**: `1`

#### Inherited from

`PollardType.version`

## Methods

### addLeaf()

> **addLeaf**(`leaf`): `boolean`

#### Parameters

• **leaf**: [`LeafType`](../type-aliases/LeafType.md)

#### Returns

`boolean`

***

### all()

> **all**(): [`LeafType`](../type-aliases/LeafType.md)[]

#### Returns

[`LeafType`](../type-aliases/LeafType.md)[]

***

### append()

> **append**(`type`, `data`, `options`?): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Parameters

• **type**: [`LeafTypes`](../enumerations/LeafTypes.md)

• **data**: `string` \| `CID`\<`unknown`, `number`, `number`, `Version`\> \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

• **options?**

• **options.key?**: `string`

• **options.sortFields?**: `number`[]

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

***

### compare()

> **compare**(`other`?): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

#### Parameters

• **other?**: [`PollardInterface`](PollardInterface.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`object`\>

##### difference

> **difference**: [[`LeafType`](../type-aliases/LeafType.md)[], [`LeafType`](../type-aliases/LeafType.md)[]]

##### isEqual

> **isEqual**: `boolean`

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

• **index**: `number`

#### Returns

[`LeafType`](../type-aliases/LeafType.md)

***

### getNode()

> **getNode**(`layer`, `index`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`LeafType`](../type-aliases/LeafType.md)\>

#### Parameters

• **layer**: `number`

• **index**: `number`

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

> **iterator**(): [`Generator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator)\<[`LeafType`](../type-aliases/LeafType.md), `any`, `unknown`\>

#### Returns

[`Generator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator)\<[`LeafType`](../type-aliases/LeafType.md), `any`, `unknown`\>

***

### toJSON()

> **toJSON**(): [`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`PollardType`](../type-aliases/PollardType.md), `"cid"`\>

#### Returns

[`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`PollardType`](../type-aliases/PollardType.md), `"cid"`\>

***

### updateLayers()

> **updateLayers**(`startPosition`?): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>

#### Parameters

• **startPosition?**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`CID`\<`unknown`, `number`, `number`, `Version`\>\>
