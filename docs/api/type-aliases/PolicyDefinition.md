[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / PolicyDefinition

# Type Alias: PolicyDefinition

> **PolicyDefinition** = `object`

A json-logic policy, exactly as signed into a database. Write your own for
`accessPolicy` / `validationPolicy`; the inputs available to the rule are listed
in docs/policies.md.

## Properties

### description

> `readonly` **description**: `string`

***

### logic

> `readonly` **logic**: `RulesLogic`

***

### name

> `readonly` **name**: `string`

***

### version

> `readonly` **version**: `1`

Policy format version; always 1.
