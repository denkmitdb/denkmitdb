[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / PolicyController

# Class: PolicyController

## Implements

- [`PolicyInterface`](../interfaces/PolicyInterface.md)

## Constructors

### Constructor

> **new PolicyController**(`consensus`): `PolicyController`

#### Parameters

##### consensus

[`DenkmitData`](../type-aliases/DenkmitData.md)\<[`PolicyData`](../type-aliases/PolicyData.md)\>

#### Returns

`PolicyController`

## Properties

### cid

> **cid**: `CID`

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`cid`](../interfaces/PolicyInterface.md#cid)

***

### creator

> **creator**: `CID`

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`creator`](../interfaces/PolicyInterface.md#creator)

***

### description

> **description**: `string`

The description of the consensus.

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`description`](../interfaces/PolicyInterface.md#description)

***

### logic

> **logic**: `RulesLogic`

The consensus logic.

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`logic`](../interfaces/PolicyInterface.md#logic)

***

### name

> **name**: `string`

The name of the consensus.

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`name`](../interfaces/PolicyInterface.md#name)

***

### version

> **version**: `1`

The version of the consensus.

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`version`](../interfaces/PolicyInterface.md#version)

## Methods

### execute()

> **execute**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

Evaluates the policy. Strict: only a literal `true` result authorizes —
json-logic readily returns strings, numbers and arrays, and treating
truthiness as authorization would make a buggy policy fail open
(KNOWN_ISSUES.md #25).

#### Parameters

##### data

[`PolicyInput`](../type-aliases/PolicyInput.md)

Deterministic inputs only (manifest + signed-entry data).

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

Whether the policy accepts the input.

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`execute`](../interfaces/PolicyInterface.md#execute)

***

### toJSON()

> **toJSON**(): [`PolicyData`](../type-aliases/PolicyData.md)

#### Returns

[`PolicyData`](../type-aliases/PolicyData.md)

#### Implementation of

[`PolicyInterface`](../interfaces/PolicyInterface.md).[`toJSON`](../interfaces/PolicyInterface.md#tojson)
