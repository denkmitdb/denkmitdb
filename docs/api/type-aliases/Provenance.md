[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Provenance

# Type Alias: Provenance

> **Provenance** = `object`

Who wrote the current record for a key, and when.

## Properties

### cid

> `readonly` **cid**: `CID`

CID of the signed entry.

***

### creator

> `readonly` **creator**: `CID`

Identity CID of the writer.

***

### deleted

> `readonly` **deleted**: `boolean`

True when the current record is a tombstone.

***

### timestamp

> `readonly` **timestamp**: `number`
