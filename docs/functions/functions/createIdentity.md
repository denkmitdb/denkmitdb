[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createIdentity

# Function: createIdentity()

> **createIdentity**(`name`, `passphrase`, `helia`, `alg`?): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)\>

Creates a new identity with the given name and passphrase.

## Parameters

• **name**: `string`

The name of the new identity.

• **passphrase**: `string`

The passphrase to encrypt the identity's private key.

• **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

The Helia instance used for data storage.

• **alg?**: [`IdentityAlgorithms`](../../types/type-aliases/IdentityAlgorithms.md)

The algorithm to use for key generation.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)\>

A Promise that resolves to the created IdentityInterface.

## Throws

An Error if the identity already exists.
