import Keyv from "keyv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDenkmitDatabase, createIdentity, openDenkmitDatabase } from "../src/functions";
import { IdentityInterface } from "../src/types";
import { createTestNode, TestNode } from "./helpers";

type Value = { value: string };

/**
 * Pre-publish hardening (see the four items in the review that led here): denied
 * writes must not persist blocks, a caller's Keyv must survive load(), reads must
 * tolerate unfetchable blocks, and listings must be possible without value fetches.
 */
describe("Pre-publish hardening", () => {
    let node: TestNode;
    let other: IdentityInterface;

    beforeAll(async () => {
        node = await createTestNode("hardening");
        other = await createIdentity("hardening-other", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("an unauthorized set() persists and pins nothing", async () => {
        const db = await createDenkmitDatabase<Value>("hard-no-pin", { helia: node.helia, identity: node.identity });
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });

        const pinsBefore: string[] = [];
        for await (const pin of node.helia.pins.ls()) pinsBefore.push(pin.cid.toString());

        await expect(dbAsB.set("k", { value: "v" })).rejects.toThrow(/access denied/i);
        await expect(dbAsB.delete("k")).rejects.toThrow(/access denied/i);

        const pinsAfter: string[] = [];
        for await (const pin of node.helia.pins.ls()) pinsAfter.push(pin.cid.toString());
        // The rejected write/tombstone must not have signed+stored+pinned a block.
        expect(pinsAfter.sort()).toEqual(pinsBefore.sort());

        await dbAsB.close();
        await db.close();
    });

    it("load() from a remote head does not clear a caller-supplied Keyv wholesale", async () => {
        const keyv = new Keyv<Value>();
        await keyv.set("unrelated", { value: "the caller's own data" });

        const writer = await createDenkmitDatabase<Value>("hard-keyv", { helia: node.helia, identity: node.identity });
        await writer.set("shared", { value: "from writer" });
        await writer.idle();
        const head = await writer.createHead();

        // A second instance over the same helia, caller-supplied Keyv, empty index:
        // syncing the head takes the load() path (size === 0 → full replacement).
        const reader = await openDenkmitDatabase<Value>(writer.address, {
            helia: node.helia,
            identity: node.identity,
            keyValueStorage: keyv,
        });
        await reader.syncNewHead(head.cid.bytes);
        await reader.idle();

        expect(await reader.get("shared")).toEqual({ value: "from writer" });
        // The caller's unrelated key survived the load-triggered invalidation.
        expect(await keyv.get("unrelated")).toEqual({ value: "the caller's own data" });

        await reader.close();
        await writer.close();
    });

    it("provenance() answers from the index and get() tolerates an unfetchable entry", async () => {
        const db = await createDenkmitDatabase<Value>("hard-missing", { helia: node.helia, identity: node.identity });
        await db.set("k", { value: "v" });
        await db.idle();

        const record = await db.provenance("k");
        expect(record).toBeDefined();
        expect(record!.creator.equals(node.identity.cid)).toBe(true);
        expect(record!.deleted).toBe(false);

        // Simulate an unfetchable block (never replicated / GC'd elsewhere): a
        // real miss stalls on bitswap for the full 30 s fetch deadline, so stub
        // the signed-fetch layer to fail deterministically instead, and drop the
        // value cache so get() must go through it.
        const controller = db.heliaController as unknown as {
            getSigned: (...args: unknown[]) => Promise<unknown>;
        };
        const realGetSigned = controller.getSigned;
        controller.getSigned = async () => {
            throw new ReferenceError("Entry not found");
        };
        await (db as unknown as { keyValueStorage: Keyv<Value> }).keyValueStorage.delete("k");

        try {
            await expect(db.get("k")).resolves.toBeUndefined(); // absent, not a throw
            await expect(db.provenance("k")).resolves.toBeDefined(); // index-served, no fetch involved

            // iterator() skips the unfetchable key instead of aborting.
            const seen: string[] = [];
            for await (const [key] of db.iterator()) seen.push(key);
            expect(seen).not.toContain("k");
        } finally {
            controller.getSigned = realGetSigned;
        }

        await db.close();
    });

    it("keys() lists live keys without fetching values and skips tombstones", async () => {
        const db = await createDenkmitDatabase<Value>("hard-keys", { helia: node.helia, identity: node.identity });
        await db.set("a", { value: "1" });
        await db.set("b", { value: "2" });
        await db.set("c", { value: "3" });
        await db.delete("b");
        await db.idle();

        const keys: string[] = [];
        for await (const key of db.keys()) keys.push(key);
        expect(keys.sort()).toEqual(["a", "c"]);

        await db.close();
    });
});
