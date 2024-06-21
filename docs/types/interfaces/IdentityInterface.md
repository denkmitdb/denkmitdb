[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / IdentityInterface

# Interface: IdentityInterface

## Extends

- [`IdentityType`](../type-aliases/IdentityType.md)

## Properties

### alg

> `readonly` **alg**: [`IdentityAlgorithms`](../type-aliases/IdentityAlgorithms.md)

#### Inherited from

`IdentityType.alg`

***

### cid

> `readonly` **cid**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`IdentityType.cid`

***

### creator

> `readonly` **creator**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`IdentityType.creator`

***

### name

> `readonly` **name**: `string`

#### Inherited from

`IdentityType.name`

***

### publicKey

> `readonly` **publicKey**: `string`

#### Inherited from

`IdentityType.publicKey`

***

### type

> `readonly` **type**: [`publicKey`](../enumerations/IdentityTypes.md#publickey)

#### Inherited from

`IdentityType.type`

***

### version

> `readonly` **version**: `1`

#### Inherited from

`IdentityType.version`

***

### link?

> `optional` `readonly` **link**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`IdentityType.link`

## Methods

### decrypt()

> **decrypt**(`jwe`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

#### Parameters

• **jwe**: `FlattenedJWE`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

***

### encrypt()

> **encrypt**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

#### Parameters

• **data**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

***

### sign()

> **sign**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

#### Parameters

• **data**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

***

### signWithoutPayload()

> **signWithoutPayload**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

#### Parameters

• **data**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

***

### verify()

> **verify**(`jws`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>

#### Parameters

• **jws**: `FlattenedJWSInput`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`undefined` \| [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\>
