[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / decryptValue

# Function: decryptValue()

> **decryptValue**\<`T`\>(`identity`, `value`, `expected?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Decrypts a value produced by [encryptValueFor](encryptValueFor.md) with this identity's
private key. Returns `undefined` when this identity is not a recipient, its
private key is unavailable, the envelope is malformed or tampered with, or —
when `expected` is given — the envelope is not bound to exactly that context
(re-posted elsewhere, or sealed without a context). It never throws, so callers
can probe records without try/catch.

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

### expected?

[`EncryptionContext`](../type-aliases/EncryptionContext.md)

The context the value is read in; strongly recommended.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

The decoded value, or undefined.
