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

### valueCache?

> `optional` **valueCache?**: [`ValueCache`](../interfaces/ValueCache.md)\<`T`\>

Default: a private in-memory cache, cleared on close (a supplied one never is).
