[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / headStoreKey

# Function: headStoreKey()

> **headStoreKey**(`manifestCid`): `Key`

Datastore key holding the CID of the last locally built head for a database,
namespaced by manifest CID (KNOWN_ISSUES.md D4). Durability follows the stores the
caller gives Helia: with a persistent datastore/blockstore the database reopens
from its own head with no live peer; with in-memory stores the pointer lives as
long as the Helia node.

## Parameters

### manifestCid

`CID`

The database address (manifest CID).

## Returns

`Key`

The datastore key for the persisted head pointer.
