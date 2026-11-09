[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / WriteOptions

# Type Alias: WriteOptions

> **WriteOptions** = `object`

Options for a write. `identity` signs the entry instead of the identity the
database was opened with — e.g. one of several agent identities a daemon holds
(specs/delegation.md, phase 1). The consensus rules are evaluated for the
identity that signs.

## Properties

### identity?

> `optional` **identity?**: [`SigningIdentity`](../interfaces/SigningIdentity.md)
