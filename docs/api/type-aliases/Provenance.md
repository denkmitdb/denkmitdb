[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Provenance

# Type Alias: Provenance

> **Provenance** = `object`

Who wrote the current record for a key, and when.

## Properties

### deleted

> `readonly` **deleted**: `boolean`

True when the current record is a tombstone.

***

### entryCid

> `readonly` **entryCid**: `CID`

CID of the signed entry.

***

### timestamp

> `readonly` **timestamp**: `number`

Write time claimed by the writer (ms since the epoch).

***

### writer

> `readonly` **writer**: `CID`

Identity CID of the entry's writer (signer).
