[**@denkmitdb/denkmitdb**](../README.md)

***

[@denkmitdb/denkmitdb](../globals.md) / Database

# Interface: Database\<T\>

A signed, replicated key-value database.

## Type Parameters

### T

`T`

The type of values stored in the database.

## Properties

### address

> `readonly` **address**: `CID`

The database address: the CID of its signed manifest.

***

### consensus

> `readonly` **consensus**: [`Consensus`](../type-aliases/Consensus.md)\<[`SignedPolicy`](../type-aliases/SignedPolicy.md)\>

The signed consensus rules the manifest binds; every replica evaluates the same ones.

***

### identity

> `readonly` **identity**: [`SigningIdentity`](SigningIdentity.md)

The identity that signs this replica's writes by default.

***

### manifest

> `readonly` **manifest**: [`Manifest`](../type-aliases/Manifest.md)

***

### recordCount

> `readonly` **recordCount**: `number`

Number of records (one per key ever written), tombstones included.

## Methods

### announceHead()

> **announceHead**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Re-announces the current head to peers even when it has not changed, so
peers that connected after the last change can converge.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### close()

> **close**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Stops sync, finishes pending work and persists the head.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### delete()

> **delete**(`key`, `options?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Deletes `key` by writing a signed tombstone. The tombstone takes part in the
same last-write-wins order as puts: while it wins, the key is hidden from
`get`/`keys`/`entries`; a newer `set` resurrects it.

#### Parameters

##### key

`string`

##### options?

[`WriteOptions`](../type-aliases/WriteOptions.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### entries()

> **entries**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`key`: `string`, `value`: `T`\]\>

Live key-value pairs in write-time order.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\[`key`: `string`, `value`: `T`\]\>

***

### get()

> **get**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

The current value of `key`, or undefined if it was never written or is deleted.

#### Parameters

##### key

`string`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`T` \| `undefined`\>

***

### keys()

> **keys**(): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<`string`\>

Live keys in write-time order, without loading values.

#### Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<`string`\>

***

### provenance()

> **provenance**(`key`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Provenance`](../type-aliases/Provenance.md) \| `undefined`\>

Provenance of the current record for `key` (tombstones too), or undefined if never written.

#### Parameters

##### key

`string`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`Provenance`](../type-aliases/Provenance.md) \| `undefined`\>

***

### set()

> **set**(`key`, `value`, `options?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Signs and stores a value for `key`; rejects if the consensus rules refuse the write.

#### Parameters

##### key

`string`

##### value

`T`

##### options?

[`WriteOptions`](../type-aliases/WriteOptions.md)

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### waitUntilIdle()

> **waitUntilIdle**(): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Resolves once this replica's queued work (tree rebuilds, merges) has
drained. Local only: it says nothing about convergence with peers.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
