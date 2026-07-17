[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / TombstoneEntryData

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
