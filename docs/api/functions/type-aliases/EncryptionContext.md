[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / EncryptionContext

# Type Alias: EncryptionContext

> **EncryptionContext** = `object`

Where an encrypted value is published: database address, record key and the
writer's identity CID. Bound into the JWE as additional authenticated data, so a
recipient can refuse an envelope that somebody re-posted elsewhere — without the
binding, anyone allowed to write could copy a sealed value under their own key,
and a recipient would read it attributed to the wrong writer or context.

## Properties

### database

> `readonly` **database**: `string`

***

### key

> `readonly` **key**: `string`

***

### writer

> `readonly` **writer**: `string`
