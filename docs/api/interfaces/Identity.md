[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Identity

# Interface: Identity

A public identity: a self-certifying key whose CID names a writer. Anyone can
fetch one ([fetchIdentity](../functions/fetchIdentity.md)) to verify signatures or encrypt to it.

## Extended by

- [`SigningIdentity`](SigningIdentity.md)

## Properties

### alg

> `readonly` **alg**: [`IdentityAlgorithm`](../type-aliases/IdentityAlgorithm.md)

***

### cid

> `readonly` **cid**: `CID`

The identity CID — the writer's name in provenance and policies.

***

### name

> `readonly` **name**: `string`

***

### publicKey

> `readonly` **publicKey**: `string`

base64 of the dag-cbor encoded public JWK.

## Methods

### encrypt()

> **encrypt**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

Encrypts to this identity alone (ECDH-ES+A256KW, A256GCM).

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`FlattenedJWE`\>

***

### verify()

> **verify**(`jws`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

Returns the payload if the signature verifies, else undefined.

#### Parameters

##### jws

`FlattenedJWSInput`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\> \| `undefined`\>

#### Throws

Error - If `jws` names no key or another identity (`kid`), or its header is malformed.
