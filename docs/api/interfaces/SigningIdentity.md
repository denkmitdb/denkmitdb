[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / SigningIdentity

# Interface: SigningIdentity

An identity whose private key is loaded: it can sign writes and decrypt.

## Extends

- [`Identity`](Identity.md)

## Properties

### alg

> `readonly` **alg**: [`IdentityAlgorithm`](../type-aliases/IdentityAlgorithm.md)

#### Inherited from

[`Identity`](Identity.md).[`alg`](Identity.md#alg)

***

### cid

> `readonly` **cid**: `CID`

The identity CID — the writer's name in provenance and policies.

#### Inherited from

[`Identity`](Identity.md).[`cid`](Identity.md#cid)

***

### name

> `readonly` **name**: `string`

#### Inherited from

[`Identity`](Identity.md).[`name`](Identity.md#name)

***

### publicKey

> `readonly` **publicKey**: `string`

base64 of the dag-cbor encoded public JWK.

#### Inherited from

[`Identity`](Identity.md).[`publicKey`](Identity.md#publickey)

## Methods

### decrypt()

> **decrypt**(`jwe`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

The plaintext, or undefined if the JWE was not encrypted to this identity or fails to verify.

#### Parameters

##### jwe

`FlattenedJWE`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

***

### encrypt()

> **encrypt**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

Encrypts to this identity alone (ECDH-ES+A256KW, A256GCM).

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

#### Inherited from

[`Identity`](Identity.md).[`encrypt`](Identity.md#encrypt)

***

### sign()

> **sign**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWS`\>

***

### verify()

> **verify**(`jws`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

Returns the payload if `jws` was signed by this identity, else undefined.

#### Parameters

##### jws

`FlattenedJWSInput`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

#### Inherited from

[`Identity`](Identity.md).[`verify`](Identity.md#verify)
