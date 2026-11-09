[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Manifest

# Type Alias: Manifest

> **Manifest** = `object`

A database's signed manifest. Its CID is the database address.

## Properties

### cid

> `readonly` **cid**: `CID`

The database address.

***

### consensus

> `readonly` **consensus**: [`Consensus`](Consensus.md)\<`CID`\>

CIDs of the consensus rules (wire keys: `access`, and `consensus` for validity).

***

### creator

> `readonly` **creator**: `CID`

Identity CID of the database creator.

***

### name

> `readonly` **name**: `string`

***

### subtreeLeaves

> `readonly` **subtreeLeaves**: `number`

Leaves per Merkle subtree (a power of two; `order` = log2 on the wire).

***

### timestamp

> `readonly` **timestamp**: `number`

***

### type

> `readonly` **type**: `string`

***

### version

> `readonly` **version**: `number`

***

### metadata?

> `readonly` `optional` **metadata?**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>
