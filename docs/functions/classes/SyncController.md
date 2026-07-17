[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / SyncController

# Class: SyncController

Represents a SyncController that handles synchronization operations.

## Implements

- [`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md)

## Constructors

### Constructor

> **new SyncController**(`heliaController`, `name`): `SyncController`

#### Parameters

##### heliaController

[`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

##### name

`string`

#### Returns

`SyncController`

## Properties

### heliaController

> **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

***

### name

> **name**: `string`

***

### queue

> **queue**: `PQueue`

***

### scheduleQueue

> **scheduleQueue**: `PQueue`

***

### newHead?

> `optional` **newHead?**: (`data`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### data

[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

## Methods

### addRepetitiveTask()

> **addRepetitiveTask**(`task`, `interval`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### task

() => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

##### interval

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`addRepetitiveTask`](../../types/interfaces/SyncControllerInterface.md#addrepetitivetask)

***

### addTask()

> **addTask**(`task`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### task

() => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

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

##### message

[`CustomEvent`](https://developer.mozilla.org/docs/Web/API/CustomEvent)\<`Message`\>

#### Returns

`void`

***

### onIdle()

> **onIdle**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Resolves when the task queue has drained.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`onIdle`](../../types/interfaces/SyncControllerInterface.md#onidle)

***

### sendHead()

> **sendHead**(`head`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### head

[`HeadType`](../../types/type-aliases/HeadType.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`sendHead`](../../types/interfaces/SyncControllerInterface.md#sendhead)

***

### start()

> **start**(`newHead`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Parameters

##### newHead

(`data`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

#### Implementation of

[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md).[`start`](../../types/interfaces/SyncControllerInterface.md#start)
