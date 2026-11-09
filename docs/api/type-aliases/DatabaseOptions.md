[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / DatabaseOptions

# Type Alias: DatabaseOptions\<T\>

> **DatabaseOptions**\<`T`\> = `object`

Options for opening a database.

## Type Parameters

### T

`T`

## Properties

### helia

> **helia**: [`HeliaNode`](HeliaNode.md)

***

### identity

> **identity**: [`SigningIdentity`](../interfaces/SigningIdentity.md)

***

### cache?

> `optional` **cache?**: `Keyv`\<`T`\>

Value cache keyed by entry CID. Entry values never change, so one cache may
be shared between databases. Default: a private in-memory Keyv.
