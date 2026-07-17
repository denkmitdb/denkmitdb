[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / SetResult

# Type Alias: SetResult

> **SetResult** = `object`

Outcome of [SortedItemsStoreInterface.set](../interfaces/SortedItemsStoreInterface.md#set). `applied` is true when the
record became the live record for its key (last-write-wins). When it displaced
an earlier record, `previousTimestamp` is that record's timestamp, so the tree
can be rebuilt from the earlier of the two positions.

## Properties

### applied

> `readonly` **applied**: `boolean`

***

### previousTimestamp?

> `readonly` `optional` **previousTimestamp?**: `number`
