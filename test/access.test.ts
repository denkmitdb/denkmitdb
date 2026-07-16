import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDenkmitDatabase,
    createIdentity,
    emptyCID,
    HeliaController,
    openDenkmitDatabase,
} from "../src/functions";
import { IdentityInterface } from "../src/types";
import { buildHead, createTestNode, putSignedEntry, TestNode } from "./helpers";

type Value = { value: string };

/**
 * Access control (KNOWN_ISSUES.md D1, ROADMAP.md Phase 4 step 2). The default policy
 * is creator-only: only the identity that created the database may write, enforced on
 * both the local `set` path and the authenticated merge/load path. `publicWrite: true`
 * opts into a world-writable database. The policy is a deterministic json-logic rule
 * bound to the manifest, so every replica reaches the same decision.
 */
describe("Access control", () => {
    let node: TestNode; // node.identity = the creator ("A")
    let other: IdentityInterface; // a different, non-creator identity ("B")
    let otherController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("access-owner");
        other = await createIdentity("access-other", "pw", node.helia);
        otherController = new HeliaController(node.helia, other);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    async function createDb(name: string, publicWrite = false) {
        return createDenkmitDatabase<Value>(name, { helia: node.helia, identity: node.identity, publicWrite });
    }

    it("installs a real (non-empty) access policy in the manifest and lets the creator write", async () => {
        const db = await createDb("acc-default");
        const manifest = await db.getManifest();
        expect(manifest.access.equals(await emptyCID())).toBe(false);

        await db.set("k", { value: "v" });
        await db.idle();
        expect(await db.get("k")).toEqual({ value: "v" });
        await db.close();
    });

    it("rejects a local write from a non-creator identity", async () => {
        const db = await createDb("acc-reject-local");
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });

        await expect(dbAsB.set("k", { value: "v" })).rejects.toThrow(/access denied/i);
        expect(dbAsB.size).toBe(0);

        await dbAsB.close();
        await db.close();
    });

    it("rejects a non-creator entry arriving through merge (not indexed)", async () => {
        const db = await createDb("acc-reject-merge");

        // A head bound to this database's manifest, whose leaf links an entry signed
        // by B. Authentication succeeds (B's signature is valid), but authorization
        // must reject it under the creator-only policy.
        const entry = await putSignedEntry(otherController, "intruder", { value: "x" }, Date.now());
        const head = await buildHead(otherController, db.address, [
            { cid: entry.cid, creator: entry.creator, sort: [entry.timestamp], key: entry.key },
        ]);

        await db.syncNewHead(head.cid.bytes);
        await db.idle();

        expect(db.size).toBe(0);
        expect(await db.get("intruder")).toBeUndefined();
        await db.close();
    });

    it("publicWrite: true allows a non-creator identity to write", async () => {
        const db = await createDb("acc-public", true);
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });

        await dbAsB.set("k", { value: "from B" });
        await dbAsB.idle();
        expect(await dbAsB.get("k")).toEqual({ value: "from B" });

        await dbAsB.close();
        await db.close();
    });

    it("open reads the policy from the signed manifest, ignoring local publicWrite", async () => {
        // Database created creator-only; a peer opening it cannot loosen the policy by
        // passing publicWrite locally (that would let replicas disagree — KNOWN_ISSUES #19).
        const db = await createDb("acc-no-local-override", false);
        const dbAsB = await openDenkmitDatabase<Value>(db.address, {
            helia: node.helia,
            identity: other,
            publicWrite: true,
        });

        await expect(dbAsB.set("k", { value: "v" })).rejects.toThrow(/access denied/i);
        await dbAsB.close();
        await db.close();
    });
});
