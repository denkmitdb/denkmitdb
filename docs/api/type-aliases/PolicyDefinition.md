[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / PolicyDefinition

# Type Alias: PolicyDefinition

> **PolicyDefinition** = `object`

A policy, exactly as signed into a database — one of its consensus rules. Write
your own for `consensus.access` (`{ policy }`) or `consensus.validity`; the inputs
a rule sees are listed in docs/policies.md.

## Properties

### description

> `readonly` **description**: `string`

***

### logic

> `readonly` **logic**: [`PolicyRule`](PolicyRule.md)

***

### name

> `readonly` **name**: `string`

***

### version

> `readonly` **version**: `1`

The policy language: 1 = DenkMit Logic 1.
