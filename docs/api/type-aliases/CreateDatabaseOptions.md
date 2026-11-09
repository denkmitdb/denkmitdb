[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / CreateDatabaseOptions

# Type Alias: CreateDatabaseOptions\<T\>

> **CreateDatabaseOptions**\<`T`\> = [`DatabaseOptions`](DatabaseOptions.md)\<`T`\> & `object` & (\{ `access?`: [`AccessPreset`](AccessPreset.md); `accessPolicy?`: `never`; \} \| \{ `accessPolicy`: [`PolicyDefinition`](PolicyDefinition.md); `access?`: `never`; \})

Options for creating a database: the open options plus what the manifest fixes for good.

## Type Parameters

### T

`T`

## Type Declaration

### order?

> `optional` **order?**: `number`

Pollard order, an integer in [1, 8]; default 3.

### validationPolicy?

> `optional` **validationPolicy?**: [`PolicyDefinition`](PolicyDefinition.md)

Custom validation policy. Default accepts every authorized entry.
