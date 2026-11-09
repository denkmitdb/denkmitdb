/**
 * Writes test/wire/wire-v4.json from the CURRENT code. Run once, before a
 * refactor, and commit the result: `npx tsx test/wire/generate.ts`.
 * Never regenerate to make a failing wire test pass — that defeats its purpose.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Key } from "interface-datastore";
import { CID } from "multiformats/cid";
import { toString as toHex } from "uint8arrays";
import { createDenkmitDatabase, createIdentity } from "../../src/functions";
import { LEGACY_MANIFEST_VERSION } from "../../src/types";
import { createTestNode } from "../helpers";
import { blockBytes, FIXTURE_IDENTITY, runDeterministicFlows, writers, type CapturedBlocks } from "./wire-flows";

const node = await createTestNode("wire-generator");
const helia = node.helia;
const identity = await createIdentity(FIXTURE_IDENTITY.name, FIXTURE_IDENTITY.passphrase, helia);
const controller = new writers.HeliaController(helia, identity);

// --- captured blocks, really signed by the current code
const db = await createDenkmitDatabase<unknown>("wire-captured", {
    helia,
    identity,
    access: "namespace-per-writer",
});
const mine = `agents/${identity.cid.toString()}/`;
await db.set(`${mine}keep`, { kept: true, n: 7 });
await db.set(`${mine}drop`, "soon deleted");
await db.delete(`${mine}drop`);
await db.idle();
const head = await db.createHead();
const manifestV2 = db.address;
const entryV2 = (await db.provenance(`${mine}keep`))!;
const tombstone = (await db.provenance(`${mine}drop`))!;
const dbValues: Record<string, unknown> = {};
for await (const [k, v] of db.iterator()) dbValues[k] = v;
const policy = (await db.getManifest()).access;
await db.close();

const v1 = await writers.createEntry("legacy/key", { legacy: true }, controller); // no manifest → v1
const consensus = await writers.createPolicy(
    { version: 1, name: "legacy-consensus", description: "legacy", logic: true },
    controller,
);
const access = await writers.createPolicy(
    { version: 1, name: "legacy-access", description: "legacy", logic: true },
    controller,
);
const manifestV1 = await writers.createManifest(
    {
        version: LEGACY_MANIFEST_VERSION,
        name: "wire-legacy",
        type: "denkmit-database-key-value",
        order: 3,
        consensus: consensus.cid,
        access: access.cid,
        timestamp: 1_700_000_000_000,
    },
    controller,
);

const blocks: Record<string, string> = {};
for await (const { cid } of helia.blockstore.getAll()) {
    blocks[cid.toString()] = toHex(await blockBytes(helia, cid as CID), "hex");
}
const datastoreKey = new Key(`/Denkmit//${FIXTURE_IDENTITY.name}`).toString();
const captured: CapturedBlocks = {
    identity: {
        cid: identity.cid.toString(),
        datastoreKey,
        datastoreValue: toHex(await helia.datastore.get(new Key(datastoreKey)), "hex"),
    },
    blocks,
    refs: {
        entryV2: entryV2.cid.toString(),
        entryV1: v1.cid.toString(),
        tombstone: tombstone.cid.toString(),
        manifestV2: manifestV2.toString(),
        manifestV1: manifestV1.cid.toString(),
        policy: policy.toString(),
        head: head.cid.toString(),
    },
    expect: {
        manifestV2Name: "wire-captured",
        entryV2: { key: `${mine}keep`, value: { kept: true, n: 7 }, timestamp: entryV2.timestamp },
        entryV1: { key: "legacy/key", value: { legacy: true }, timestamp: v1.timestamp },
        tombstoneKey: `${mine}drop`,
        dbValues,
    },
};

// --- deterministic payloads (signing stubbed, clock fixed) on a fresh node with the same identity
await node.stop();
const fresh = await createTestNode("wire-generator-2");
const { installCaptured } = await import("./wire-flows");
const fixed = await installCaptured(fresh.helia, captured);
const deterministic = await runDeterministicFlows(fresh.helia, fixed);
await fresh.stop();

const out = join(dirname(fileURLToPath(import.meta.url)), "wire-v4.json");
writeFileSync(out, JSON.stringify({ generatedAt: "2026-11-09", captured, deterministic }, null, 2) + "\n");
console.log(
    `wrote ${out}: ${Object.keys(blocks).length} blocks, ${deterministic.payloads.length} deterministic payloads`,
);
process.exit(0);
