[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / fetchIdentity

# Function: fetchIdentity()

> **fetchIdentity**(`cid`, `helia`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Identity`](../interfaces/Identity.md)\>

Fetches a public identity by CID (from the local blockstore or the network) and
verifies that the block is self-certifying for the key it advertises.

## Parameters

### cid

`string` \| `CID`\<`unknown`, `number`, `number`, `Version`\>

The identity CID.

### helia

[`HeliaNode`](../type-aliases/HeliaNode.md)

The node to fetch through.

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Identity`](../interfaces/Identity.md)\>
