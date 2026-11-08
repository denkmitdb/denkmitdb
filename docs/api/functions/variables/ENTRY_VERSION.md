[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / ENTRY\_VERSION

# Variable: ENTRY\_VERSION

> `const` **ENTRY\_VERSION**: `2` = `2`

Current entry format. v2 entries carry the address (manifest CID) of the
database they were written to, inside the signed payload, so an entry cannot be
replayed into another database that shares a writer (KNOWN_ISSUES.md #24).
