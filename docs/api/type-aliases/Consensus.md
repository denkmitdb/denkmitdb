[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Consensus

# Type Alias: Consensus\<P\>

> **Consensus**\<`P`\> = `object`

Consensus rules: what every replica enforces identically, so replicas that see
the same signed entries reach the same state. Both rules are deterministic
json-logic, signed into the manifest for good (docs/policies.md).

## Type Parameters

### P

`P`

## Properties

### access

> `readonly` **access**: `P`

Who may write (and delete) which keys.

***

### validity

> `readonly` **validity**: `P`

Which authorized, signed entries are valid.
