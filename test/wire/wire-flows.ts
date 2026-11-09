/**
 * Wire-format safety net for the public-API refactor (November 2026).
 *
 * Two kinds of evidence that a refactor did not change what goes on the wire:
 *
 * 1. Deterministic payloads — with a fixed identity, a fixed clock and signing
 *    replaced by a deterministic stand-in (CID = sha256 of the payload), the
 *    public factories must produce byte-identical payloads and pollard CIDs.
 *    (Real ES384 signatures are randomized, so signed-block CIDs are not stable.)
 * 2. Captured blocks — real signed blocks written by the pre-refactor code must
 *    still be readable, and a database must still open from them.
 *
 * Only the calls inside these flows may change during the refactor (new names);
 * the recorded fixture `wire-v4.json` must not.
 */
import * as codec from "@ipld/dag-cbor";
import { Key } from "interface-datastore";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import type { RulesLogic } from "json-logic-js";
import { toString as toHex, fromString as fromHex } from "uint8arrays";
import {
    createDenkmitDatabase,
    createEntry,
    createManifest,
    createPolicy,
    createTombstone,
    HeliaController,
    openIdentity,
} from "../../src/functions";
import type { DenkmitHeliaInterface, IdentityInterface } from "../../src/types";

export const FIXTURE_IDENTITY = { name: "wire-fixture", passphrase: "wire-fixture-passphrase" };
const T0 = 1_800_000_000_000;

export type DeterministicRecord = {
    payloads: string[]; // hex dag-cbor of every signed payload, in signing order
    cids: Record<string, string>;
};

/**
 * Runs the public write flows with deterministic signing and a fixed clock.
 * The stand-in signer records each payload and returns CID(sha256(payload)).
 */
export async function runDeterministicFlows(
    helia: DenkmitHeliaInterface,
    identity: IdentityInterface,
): Promise<DeterministicRecord> {
    const payloads: string[] = [];
    const proto = HeliaController.prototype as unknown as {
        addSigned: (this: { identity: IdentityInterface }, data: unknown) => Promise<unknown>;
    };
    const realAddSigned = proto.addSigned;
    const realNow = Date.now;
    let t = T0;
    proto.addSigned = async function (data: unknown) {
        const bytes = codec.encode(data);
        payloads.push(toHex(bytes, "hex"));
        const cid = CID.create(1, codec.code, await sha256.digest(bytes));
        return { data, cid, creator: this.identity.cid };
    };
    Date.now = () => (t += 1000);
    const cids: Record<string, string> = {};
    try {
        const plain = await createDenkmitDatabase<unknown>("wire-plain", { helia, identity });
        cids.plainAddress = plain.address.toString();
        await plain.close();

        const ns = await createDenkmitDatabase<unknown>("wire-ns", {
            helia,
            identity,
            access: "namespace-per-writer",
            order: 2,
        });
        cids.nsAddress = ns.address.toString();
        const mine = `agents/${identity.cid.toString()}/`;
        await ns.set(`${mine}string`, "a string");
        await ns.set(`${mine}object`, { n: 1, nested: { list: [1, "two", null], flag: true } });
        await ns.set(`${mine}gone`, 42);
        await ns.delete(`${mine}gone`);
        for (let i = 0; i < 6; i++) await ns.set(`${mine}k${i}`, i);
        await ns.idle();
        const head = await ns.createHead();
        cids.nsHeadRoot = head.root.toString();
        cids.nsHead = head.cid.toString();
        await ns.close();

        const custom = await createDenkmitDatabase<unknown>("wire-custom", {
            helia,
            identity,
            accessPolicy: {
                version: 1,
                name: "puts-open-deletes-creator",
                description: "fixture",
                logic: {
                    or: [
                        { "==": [{ var: "entryOperation" }, "put"] },
                        { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
                    ],
                },
            },
            validationPolicy: {
                version: 1,
                name: "facts-only",
                description: "fixture",
                logic: { startsWith: [{ var: "entryKey" }, "facts/"] } as unknown as RulesLogic,
            },
        });
        cids.customAddress = custom.address.toString();
        await custom.close();
    } finally {
        proto.addSigned = realAddSigned;
        Date.now = realNow;
    }
    return { payloads, cids };
}

export type CapturedBlocks = {
    identity: { cid: string; datastoreKey: string; datastoreValue: string };
    blocks: Record<string, string>; // cid -> hex bytes
    refs: {
        entryV2: string;
        entryV1: string;
        tombstone: string;
        manifestV2: string;
        manifestV1: string;
        policy: string;
        head: string;
    };
    expect: {
        manifestV2Name: string;
        entryV2: { key: string; value: unknown; timestamp: number };
        entryV1: { key: string; value: unknown; timestamp: number };
        tombstoneKey: string;
        dbValues: Record<string, unknown>;
    };
};

/** Reads one block's bytes from the blockstore (helia 7 returns them directly or as chunks). */
export async function blockBytes(helia: DenkmitHeliaInterface, cid: CID): Promise<Uint8Array> {
    const got = (await (helia.blockstore as unknown as { get(c: CID): unknown }).get(cid)) as
        | Uint8Array
        | AsyncIterable<Uint8Array>;
    if (got instanceof Uint8Array) return got;
    const parts: Uint8Array[] = [];
    for await (const part of got) parts.push(part);
    return Uint8Array.from(parts.flatMap((p) => [...p]));
}

/** Loads captured blocks and the fixture identity's key into a node. */
export async function installCaptured(helia: DenkmitHeliaInterface, captured: CapturedBlocks): Promise<IdentityInterface> {
    for (const [cid, hex] of Object.entries(captured.blocks)) {
        await helia.blockstore.put(CID.parse(cid), fromHex(hex, "hex"));
    }
    await helia.datastore.put(
        new Key(captured.identity.datastoreKey),
        fromHex(captured.identity.datastoreValue, "hex"),
    );
    return openIdentity(FIXTURE_IDENTITY.name, FIXTURE_IDENTITY.passphrase, helia);
}

/** Helpers the generator uses to write real (randomly signed) blocks with the current code. */
export const writers = { createEntry, createTombstone, createManifest, createPolicy, HeliaController };
