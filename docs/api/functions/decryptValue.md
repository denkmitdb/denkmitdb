[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / decryptValue

# Function: decryptValue()

> **decryptValue**\<`T`\>(`identity`, `value`, `expected`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

Decrypts a value produced by [encryptValueFor](encryptValueFor.md) with this identity's
private key. Returns `undefined` when this identity is not a recipient, its
private key is unavailable, the envelope is malformed or tampered with, or the
envelope is not bound to exactly the `expected` context (re-posted under another
key, writer or database, or sealed without a context). For envelopes it never
throws, so callers can probe records without try/catch.

## Type Parameters

### T

`T`

## Parameters

### identity

[`SigningIdentity`](../interfaces/SigningIdentity.md)

A recipient identity with its private key.

### value

[`EncryptedValue`](../type-aliases/EncryptedValue.md)

The stored envelope.

### expected

[`EncryptionContext`](../type-aliases/EncryptionContext.md)

The context the value is read in: this database's address, the
  record's key and its actual writer (from `provenance`).

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

The decoded value, or undefined.

## Throws

DenkmitError - `INVALID_ARGUMENT` only for an incomplete `expected` context.
