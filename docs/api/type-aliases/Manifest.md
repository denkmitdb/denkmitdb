[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Manifest

# Type Alias: Manifest

> **Manifest** = `object`

A database's signed manifest. Its CID is the database address.

## Properties

### access

> `readonly` **access**: `CID`

CID of the access (authorization) policy.

***

### cid

> `readonly` **cid**: `CID`

The database address.

***

### creator

> `readonly` **creator**: `CID`

Identity CID of the database creator.

***

### name

> `readonly` **name**: `string`

***

### order

> `readonly` **order**: `number`

Pollard order: each Merkle subtree holds 2^order leaves.

***

### timestamp

> `readonly` **timestamp**: `number`

***

### type

> `readonly` **type**: `string`

***

### validation

> `readonly` **validation**: `CID`

CID of the validation policy (`consensus` on the wire).

***

### version

> `readonly` **version**: `number`

***

### meta?

> `readonly` `optional` **meta?**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>
