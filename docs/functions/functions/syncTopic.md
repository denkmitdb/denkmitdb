[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / syncTopic

# Function: syncTopic()

> **syncTopic**(`manifestCid`): `string`

The pubsub topic a database syncs on. Derived from the manifest CID (the database
address), not its name, so distinct databases that happen to share a name do not
share a topic (KNOWN_ISSUES.md D5). Versioned so a future wire change can move to a
new topic namespace.

## Parameters

### manifestCid

`CID`

The database address (manifest CID).

## Returns

`string`

The versioned, manifest-scoped topic string.
