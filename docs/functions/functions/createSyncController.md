[**@denkmitdb/denkmitdb**](../../README.md) • **Docs**

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / createSyncController

# Function: createSyncController()

> **createSyncController**(`name`, `heliaController`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md)\>

Creates a sync controller with the specified name and Helia controller.

## Parameters

• **name**: `string`

The name of the sync controller.

• **heliaController**: [`HeliaControllerInterface`](../../types/interfaces/HeliaControllerInterface.md)

The Helia controller to associate with the sync controller.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`SyncControllerInterface`](../../types/interfaces/SyncControllerInterface.md)\>

A promise that resolves to the created SyncController instance.
