[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / DenkmitDatabaseType

# Type alias: DenkmitDatabaseType\<T\>

> **DenkmitDatabaseType**\<`T`\>: `object`

## Type parameters

• **T**

## Type declaration

### address

> `readonly` **address**: `CID`

### heliaController

> `readonly` **heliaController**: [`HeliaControllerInterface`](../interfaces/HeliaControllerInterface.md)

### identity

> `readonly` **identity**: [`IdentityInterface`](../interfaces/IdentityInterface.md)

### keyValueStorage

> `readonly` **keyValueStorage**: `Keyv`\<`T`, [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `T`\>\>

### layers

> `readonly` **layers**: [`PollardInterface`](../interfaces/PollardInterface.md)[][]

### manifest

> `readonly` **manifest**: [`ManifestInterface`](../interfaces/ManifestInterface.md)

### maxPollardLength

> `readonly` **maxPollardLength**: `number`

### order

> `readonly` **order**: `number`
