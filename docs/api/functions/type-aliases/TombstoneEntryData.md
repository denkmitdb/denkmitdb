[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / TombstoneEntryData

# Type Alias: TombstoneEntryData

> **TombstoneEntryData** = `object`

A tombstone: the key is deleted (specs/ordering.md — deletes participate in the
same composite LWW order; a winning tombstone hides the key, a newer put
resurrects it; the tombstone record remains in the Merkle tree).

## Properties

### deleted

> `readonly` **deleted**: `true`

***

### key

> `readonly` **key**: `string`

***

### timestamp

> `readonly` **timestamp**: `number`

***

### version

> `readonly` **version**: [`EntryVersionType`](EntryVersionType.md)

***

### manifest?

> `readonly` `optional` **manifest?**: `CID`

Database address the entry is bound to. Required from v2; absent in v1.
