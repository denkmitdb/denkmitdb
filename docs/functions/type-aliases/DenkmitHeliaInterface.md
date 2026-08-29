[**@denkmitdb/denkmitdb**](../../README.md)

***

[@denkmitdb/denkmitdb](../../modules.md) / [functions](../README.md) / DenkmitHeliaInterface

# Type Alias: DenkmitHeliaInterface

> **DenkmitHeliaInterface** = `Helia` & `object`

The node DenkMitDB runs on: a Helia 7 instance augmented with a libp2p that
provides identify + pubsub (the `@helia/libp2p` mixin shape). Helia 7 removed
the libp2p generic from `Helia` itself; the intersection keeps the
`helia.libp2p.services.pubsub` surface the sync layer uses.

## Type Declaration

### libp2p

> **libp2p**: [`DenkmitLibp2pType`](DenkmitLibp2pType.md)
