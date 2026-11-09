[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / WriteOptions

# Type Alias: WriteOptions

> **WriteOptions** = `object`

Options for a write. `identity` signs the entry instead of the identity the
database was opened with — e.g. one of several agent identities a daemon holds
(specs/delegation.md, phase 1). It needs its private key; access and validation
policies are evaluated for it.

## Properties

### identity?

> `optional` **identity?**: [`IdentityInterface`](../interfaces/IdentityInterface.md)
