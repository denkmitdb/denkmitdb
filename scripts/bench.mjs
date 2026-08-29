#!/usr/bin/env node
/**
 * Benchmark / soak harness. Measures, against the BUILT package (dist/):
 *
 *   1. write throughput — N sequential set()s (signing + indexing + queued
 *      Merkle rebuilds), then idle() to drain the rebuild queue;
 *   2. read latency — cold get() (fetch + verify from the blockstore) vs
 *      warm get() (Keyv cache hit);
 *   3. listing — keys() full walk (no value fetches);
 *   4. head build — createHead() over the settled tree;
 *   5. replication — a second node on the same machine merges the full
 *      database over TCP libp2p + bitswap (the load() path), then converges
 *      to the same root;
 *   6. reopen — a fresh instance over the same (in-memory) stores restores
 *      from the persisted head pointer (the D4 path).
 *
 * Usage:  node scripts/bench.mjs [N]        (default N=10000)
 * Emits a markdown table on stdout; machine-readable JSON on fd 3 if open.
 *
 * Honesty notes: in-memory block/data stores (numbers exclude disk I/O);
 * single writer; values are small objects (~40 bytes serialized). Wall-clock
 * on whatever machine runs it — treat as orders of magnitude, not SLAs.
 */
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCborCodec from "@ipld/dag-cbor";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createHeliaLight } from "helia";
import {
    createDenkmitDatabase,
    createIdentity,
    openDenkmitDatabase,
} from "../dist/functions/index.js";

const N = Number(process.argv[2] ?? 10_000);
if (!Number.isInteger(N) || N < 1) {
    console.error("usage: node scripts/bench.mjs [N>=1]");
    process.exit(1);
}

async function makeNode(name) {
    const node = withBitswap(
        withLibp2pLight(createHeliaLight({ codecs: [dagCborCodec] }), {
            addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
            transports: [tcp()],
            connectionEncrypters: [noise()],
            streamMuxers: [yamux()],
            services: { identify: identify(), pubsub: floodsub({ emitSelf: true }) },
        }),
    );
    await node.start();
    const identity = await createIdentity(name, "bench", node);
    return { helia: node, identity };
}

const ms = (t) => Number(t.toFixed(1));
const now = () => performance.now();
const results = [];
function record(name, totalMs, count) {
    const perOp = totalMs / count;
    results.push({ name, totalMs: ms(totalMs), count, perOpMs: Number(perOp.toFixed(3)), opsPerSec: Math.round(1000 / perOp) });
}

console.error(`bench: N=${N} …`);
const writer = await makeNode("bench-writer");
const db = await createDenkmitDatabase("bench", { helia: writer.helia, identity: writer.identity });

// 1. writes
let t = now();
for (let i = 0; i < N; i++) await db.set(`key-${i}`, { n: i, s: `value-${i}` });
const tSet = now() - t;
t = now();
await db.idle();
const tIdle = now() - t;
record("set() (sequential, incl. queued rebuild scheduling)", tSet, N);
record("idle() — drain Merkle rebuild queue after N writes", tIdle, 1);

// 2. reads
t = now();
for (let i = 0; i < Math.min(N, 1000); i++) await db.get(`key-${i}`);
record("get() warm (Keyv cache)", now() - t, Math.min(N, 1000));

// cold: new instance over the same helia — same blocks, empty cache
const head = await db.createHead();
const cold = await openDenkmitDatabase(db.address, { helia: writer.helia, identity: writer.identity });
await cold.syncNewHead(head.cid.bytes);
await cold.idle();
t = now();
for (let i = 0; i < Math.min(N, 1000); i++) await cold.get(`key-${i}`);
record("get() cold (blockstore fetch + JWS verify)", now() - t, Math.min(N, 1000));
// Close before the next phase: instances on one helia share the pubsub topic
// (emitSelf), so a lingering instance answers announcements and skews numbers.
await cold.close();

// 3. listing
t = now();
let count = 0;
for await (const _ of db.keys()) count++;
record(`keys() full walk (${count} live keys)`, now() - t, count);

// 4. head build (tree already settled — measures the no-change path)
t = now();
await db.createHead();
record("createHead() over settled tree", now() - t, 1);

// 5. replication to a second node (full-database load() over TCP+bitswap)
const reader = await makeNode("bench-reader");
await reader.helia.libp2p.dial(writer.helia.libp2p.getMultiaddrs());
const replica = await openDenkmitDatabase(db.address, { helia: reader.helia, identity: reader.identity });
t = now();
await replica.syncNewHead(head.cid.bytes);
await replica.idle();
const tRepl = now() - t;
if (replica.size !== N) throw new Error(`replica has ${replica.size}/${N} records`);
const rootA = (await db.createHead()).root;
const rootB = (await replica.createHead()).root;
if (!rootB.equals(rootA)) throw new Error("replicas diverged");
record("full replication to fresh peer (verify+index+rebuild)", tRepl, N);
await replica.close();
await reader.helia.stop();

// 6. reopen from the persisted head pointer (same helia, D4 path)
t = now();
const reopened = await openDenkmitDatabase(db.address, { helia: writer.helia, identity: writer.identity });
await reopened.idle();
const tReopen = now() - t;
if (reopened.size !== N) throw new Error(`reopen restored ${reopened.size}/${N} records`);
record("reopen from persisted head (restore + reindex)", tReopen, N);

// report
const layers = db.layers.length;
console.log(`\n### DenkMitDB bench — N=${N}, order=${db.order} (${layers}-layer tree), Node ${process.version}\n`);
console.log("| Operation | total | per-op | ops/s |");
console.log("|---|---:|---:|---:|");
for (const r of results) {
    const per = r.count > 1 ? `${r.perOpMs} ms` : "—";
    const ops = r.count > 1 ? String(r.opsPerSec) : "—";
    console.log(`| ${r.name} | ${r.totalMs} ms | ${per} | ${ops} |`);
}

try {
    const fd3 = await import("node:fs").then((fs) => fs.writeSync(3, JSON.stringify({ n: N, node: process.version, results }) + "\n"));
    void fd3;
} catch {
    /* fd 3 not open — markdown only */
}

await reopened.close();
await db.close();
await writer.helia.stop();
process.exit(0);
