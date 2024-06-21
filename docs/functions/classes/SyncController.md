[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / SyncController

# Class: SyncController

Represents a SyncController that handles synchronization operations.

## Implements

- [`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md)

## Constructors

### new SyncController()

> **new SyncController**(`heliaController`, `name`): [`SyncController`](SyncController.md)

#### Parameters

• **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

• **name**: `string`

#### Returns

[`SyncController`](SyncController.md)

## Properties

### heliaController

> **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

***

### name

> **name**: `string`

***

### queue

> **queue**: `default`\<`default`, `QueueAddOptions`\>

***

### schdeduleQueue

> **schdeduleQueue**: `default`\<`default`, `QueueAddOptions`\>

***

### newHead()?

> `optional` **newHead**: (`data`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **data**: [`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

## Methods

### addRepetitiveTask()

> **addRepetitiveTask**(`task`, `interval`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **task**

• **interval**: `number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`addRepetitiveTask`](../../types/interfaces/SyncControllerInterface.md#addrepetitivetask)

***

### addTask()

> **addTask**(`task`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **task**

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`addTask`](../../types/interfaces/SyncControllerInterface.md#addtask)

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`close`](../../types/interfaces/SyncControllerInterface.md#close)

***

### newMessage()

> **newMessage**(`message`): `void`

#### Parameters

• **message**: [`CustomEvent`](https://developer.mozilla.org/docs/Web/API/CustomEvent)\<`Message`\>

#### Returns

`void`

***

### sendHead()

> **sendHead**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **head**: [`HeadInterface`](../../types/interfaces/HeadInterface.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`sendHead`](../../types/interfaces/SyncControllerInterface.md#sendhead)

***

### start()

> **start**(`newHead`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

• **newHead**

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`start`](../../types/interfaces/SyncControllerInterface.md#start)
