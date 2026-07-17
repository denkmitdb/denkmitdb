[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [types](../README.md) / PolicyInterface

# Interface: PolicyInterface

## Extends

- [`ConsensusType`](../type-aliases/ConsensusType.md)

## Properties

### cid

> `readonly` **cid**: `CID`

#### Inherited from

`ConsensusType.cid`

***

### creator

> `readonly` **creator**: `CID`

#### Inherited from

`ConsensusType.creator`

***

### description

> `readonly` **description**: `string`

The description of the consensus.

#### Inherited from

`ConsensusType.description`

***

### logic

> `readonly` **logic**: `RulesLogic`

The consensus logic.

#### Inherited from

`ConsensusType.logic`

***

### name

> `readonly` **name**: `string`

The name of the consensus.

#### Inherited from

`ConsensusType.name`

***

### version

> `readonly` **version**: `1`

The version of the consensus.

#### Inherited from

`ConsensusType.version`

***

### link?

> `readonly` `optional` **link?**: `CID`\<`unknown`, `number`, `number`, `Version`\>

#### Inherited from

`ConsensusType.link`

## Methods

### execute()

> **execute**(`data`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

#### Parameters

##### data

`unknown`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`boolean`\>

***

### toJSON()

> **toJSON**(): [`PolicyData`](../type-aliases/PolicyData.md)

#### Returns

[`PolicyData`](../type-aliases/PolicyData.md)
