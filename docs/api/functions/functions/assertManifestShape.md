[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / assertManifestShape

# Function: assertManifestShape()

> **assertManifestShape**(`data`): `asserts data is ManifestData`

Checks a fetched manifest the way `createDenkmitDatabase` checks its inputs: a
signature proves who wrote a manifest, not that it is usable (KNOWN_ISSUES.md #24).

## Parameters

### data

`unknown`

The decoded, signature-verified manifest payload.

## Returns

`asserts data is ManifestData`

## Throws

TypeError - If the manifest is not a well-formed v1 or v2 manifest.
