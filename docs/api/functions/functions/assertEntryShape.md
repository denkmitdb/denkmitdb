[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / assertEntryShape

# Function: assertEntryShape()

> **assertEntryShape**(`data`): `asserts data is EntryData<unknown>`

Checks the shape of a decoded entry payload. A valid signature only proves who
wrote the bytes, not that they are a well-formed entry, so every field is
checked before the entry is trusted for indexing (KNOWN_ISSUES.md #24).

## Parameters

### data

`unknown`

The decoded, signature-verified payload.

## Returns

`asserts data is EntryData<unknown>`

## Throws

TypeError - If the payload is not a well-formed v1 or v2 entry.
