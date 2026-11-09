[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / DenkmitError

# Class: DenkmitError

An error with a stable [ErrorCode](../type-aliases/ErrorCode.md).

## Extends

- [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)

## Constructors

### Constructor

> **new DenkmitError**(`code`, `message`, `options?`): `DenkmitError`

#### Parameters

##### code

[`ErrorCode`](../type-aliases/ErrorCode.md)

##### message

`string`

##### options?

###### cause?

`unknown`

#### Returns

`DenkmitError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: [`ErrorCode`](../type-aliases/ErrorCode.md)
