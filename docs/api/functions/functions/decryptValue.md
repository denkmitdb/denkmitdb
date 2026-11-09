[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / decryptValue

# Function: decryptValue()

> **decryptValue**\<`T`\>(`identity`, `value`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Decrypts a value produced by [encryptValueFor](encryptValueFor.md) with this identity's
private key. Returns `undefined` when this identity is not a recipient, its
private key is unavailable, or the envelope is invalid or tampered with — it
never throws, so callers can probe records without try/catch.

## Type Parameters

### T

`T`

## Parameters

### identity

[`IdentityInterface`](../interfaces/IdentityInterface.md)

A recipient identity with its private key.

### value

[`EncryptedValue`](../type-aliases/EncryptedValue.md)

The stored envelope.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

The decoded value, or undefined.
