[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / PolicyController

# Class: PolicyController

## Implements

- [`PolicyInterface`](../../types/interfaces/PolicyInterface.md)

## Constructors

### Constructor

> **new PolicyController**(`consensus`): `PolicyController`

#### Parameters

##### consensus

[`DenkmitData`](../../types/type-aliases/DenkmitData.md)\<[`PolicyData`](../../types/type-aliases/PolicyData.md)\>

#### Returns

`PolicyController`

## Properties

### cid

> **cid**: `CID`

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`cid`](../../types/interfaces/PolicyInterface.md#cid)

***

### creator

> **creator**: `CID`

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`creator`](../../types/interfaces/PolicyInterface.md#creator)

***

### description

> **description**: `string`

The description of the consensus.

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`description`](../../types/interfaces/PolicyInterface.md#description)

***

### logic

> **logic**: `RulesLogic`

The consensus logic.

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`logic`](../../types/interfaces/PolicyInterface.md#logic)

***

### name

> **name**: `string`

The name of the consensus.

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`name`](../../types/interfaces/PolicyInterface.md#name)

***

### version

> **version**: `1`

The version of the consensus.

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`version`](../../types/interfaces/PolicyInterface.md#version)

## Methods

### execute()

> **execute**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Parameters

##### data

[`PolicyInput`](../type-aliases/PolicyInput.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`execute`](../../types/interfaces/PolicyInterface.md#execute)

***

### toJSON()

> **toJSON**(): [`PolicyData`](../../types/type-aliases/PolicyData.md)

#### Returns

[`PolicyData`](../../types/type-aliases/PolicyData.md)

#### Implementation of

[`PolicyInterface`](../../types/interfaces/PolicyInterface.md).[`toJSON`](../../types/interfaces/PolicyInterface.md#tojson)
