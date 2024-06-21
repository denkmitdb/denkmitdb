[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / openIdentity

# Function: openIdentity()

> **openIdentity**(`name`, `passphrase`, `helia`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)\>

Opens an identity with the given name and passphrase.

## Parameters

• **name**: `string`

The name of the identity to open.

• **passphrase**: `string`

The passphrase to decrypt the identity's private key.

• **helia**: [`DenkmitHeliaInterface`](../../types/type-aliases/DenkmitHeliaInterface.md)

The Helia instance used for data retrieval.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`IdentityInterface`](../../types/interfaces/IdentityInterface.md)\>

A Promise that resolves to the opened IdentityInterface.

## Throws

An Error if the identity is not found.
