[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / encryptValueFor

# Function: encryptValueFor()

> **encryptValueFor**(`recipients`, `value`, `context`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EncryptedValue`](../type-aliases/EncryptedValue.md)\>

Encrypts a value to one or more recipient identities: the value is
dag-cbor-encoded and sealed once with AES-256-GCM, and the content key is
wrapped for each recipient with ECDH-ES on its public key. Recipients may be
fetched identities (public key only) — the sender never needs their private
keys. Include your own identity to be able to read the value back.

## Parameters

### recipients

[`Identity`](../interfaces/Identity.md) \| [`Identity`](../interfaces/Identity.md)[]

One identity or a list (duplicates are folded).

### value

`unknown`

Any dag-cbor-serializable value.

### context

[`EncryptionContext`](../type-aliases/EncryptionContext.md)

Where the value is published: database address, key and the
  writer's identity CID (see [EncryptionContext](../type-aliases/EncryptionContext.md)). Bound into the envelope.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`EncryptedValue`](../type-aliases/EncryptedValue.md)\>

The envelope to store as the entry's value.

## Throws

DenkmitError - `INVALID_ARGUMENT` with no recipients, a recipient whose key
  cannot do ECDH (not EC), or an incomplete context.
