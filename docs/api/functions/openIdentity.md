[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / openIdentity

# Function: openIdentity()

> **openIdentity**(`name`, `passphrase`, `helia`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SigningIdentity`](../interfaces/SigningIdentity.md)\>

Opens an identity with the given name and passphrase.

## Parameters

### name

`string`

The name of the identity to open.

### passphrase

`string`

The passphrase to decrypt the identity's private key.

### helia

[`HeliaNode`](../type-aliases/HeliaNode.md)

The Helia instance used for data retrieval.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SigningIdentity`](../interfaces/SigningIdentity.md)\>

The identity, able to sign.

## Throws

DenkmitError - `NOT_FOUND` or `INVALID_PASSPHRASE`.
