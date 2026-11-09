[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / createIdentity

# Function: createIdentity()

> **createIdentity**(`name`, `passphrase`, `helia`, `alg?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SigningIdentity`](../interfaces/SigningIdentity.md)\>

Creates a new identity with the given name and passphrase.

## Parameters

### name

`string`

The name of the new identity.

### passphrase

`string`

The passphrase to encrypt the identity's private key.

### helia

[`HeliaNode`](../type-aliases/HeliaNode.md)

The Helia instance used for data storage.

### alg?

[`IdentityAlgorithm`](../type-aliases/IdentityAlgorithm.md)

The algorithm to use for key generation.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SigningIdentity`](../interfaces/SigningIdentity.md)\>

The new identity, able to sign.

## Throws

An Error if the identity already exists.
