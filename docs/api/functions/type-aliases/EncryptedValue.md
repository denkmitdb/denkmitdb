[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / EncryptedValue

# Type Alias: EncryptedValue

> **EncryptedValue** = `object`

A value encrypted to one or more recipient identities. It is an ordinary,
dag-cbor-serializable database value: it replicates signed and
provenance-attributed like any record, while peers relay ciphertext they cannot
read. The JWE uses the General JSON serialization — one shared ciphertext and
one wrapped key per recipient, whose `kid` is the recipient's identity CID.

What stays visible to every replica: the key, the writer (provenance), the
write time, the recipients' identity CIDs and the ciphertext size.

## Properties

### denkmitEncrypted

> `readonly` **denkmitEncrypted**: `1`

***

### jwe

> `readonly` **jwe**: `jose.GeneralJWE`
