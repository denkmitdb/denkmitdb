// The README's library example, kept runnable: `npx tsx examples/example.ts`.
// (Inside the repo it imports the sources; in your project import from "@denkmitdb/denkmitdb".)
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCbor from "@ipld/dag-cbor";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createHeliaLight } from "helia";
import { createDatabase, createIdentity } from "../src/index";
import type { HeliaNode } from "../src/index";

// A light Helia with the libp2p and bitswap mixins (in-memory stores here; pass
// FsBlockstore/FsDatastore for persistence).
const node = withBitswap(
    withLibp2pLight(createHeliaLight({ codecs: [dagCbor] }), {
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: { identify: identify(), pubsub: floodsub({ emitSelf: true }) },
    }),
);
await node.start();
const helia = node as unknown as HeliaNode;

const identity = await createIdentity("alice", "a passphrase", helia);
const db = await createDatabase<{ value: string }>("team-facts", {
    helia,
    identity,
    consensus: { access: "namespace-per-writer" },
});
console.log("database address:", db.address.toString()); // share it; others use openDatabase

const mine = `agents/${identity.cid.toString()}/`;
await db.set(`${mine}decision`, { value: "ship 4.0.0" });
console.log(await db.get(`${mine}decision`), await db.provenance(`${mine}decision`));

for await (const [key, value] of db.entries()) console.log(key, value);

await db.close(); // persists the head
await node.stop();
