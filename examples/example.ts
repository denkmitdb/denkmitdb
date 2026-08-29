import { floodsub } from "@libp2p/floodsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCborCodec from "@ipld/dag-cbor";
import { createHeliaLight } from "helia";
import { createDenkmitDatabase, createIdentity } from "../src/functions";
import type { DenkmitHeliaInterface } from "../src/types";

// helia 7: compose a light Helia (dag-cbor codec) with the libp2p and bitswap
// mixins. The libp2p config is passed verbatim (no defaults merged) and the
// node is exposed as `helia.libp2p`; start()/stop() manage both.
const node = withBitswap(
    withLibp2pLight(createHeliaLight({ codecs: [dagCborCodec] }), {
        addresses: {
            listen: ["/ip4/0.0.0.0/tcp/0"],
        },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: {
            identify: identify(),
            pubsub: floodsub({ emitSelf: true }),
        },
    }),
);
await node.start();
const helia = node as unknown as DenkmitHeliaInterface;

//  Create a new identity for Database
const identity = await createIdentity("user", "password", helia);

const db = await createDenkmitDatabase("test", { helia, identity });
console.log("Database address: ", db.address);

await db.set("key1", { value: "value1" });
await db.set("key2", { value: "value2" });
await db.set("key3", { value: "value3" });

for await (const e of db.iterator()) {
    console.log(e);
}

const value1 = await db.get("key1");
console.log("Value 1: ", value1);

await db.close();
await helia.stop();
