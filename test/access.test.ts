import type { PolicyRule } from "../src/internal";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDatabase,
    createIdentity,
    createSyncController,
    emptyCID,
    HeliaController,
    openDatabase,
} from "../src/internal";
import { isDenkmitError, SigningIdentity, PolicyDefinition } from "../src/internal";
import { buildHead, createTestNode, putSignedEntry, putSignedTombstone, TestNode } from "./helpers";

type Value = { value: string };

/**
 * Access control (KNOWN_ISSUES.md D1, ROADMAP.md Phase 4 step 2). The default policy
 * is creator-only: only the identity that created the database may write, enforced on
 * both the local `set` path and the authenticated merge/load path. `access: "public"`
 * opts into a world-writable database. The policy is a deterministic json-logic rule
 * bound to the manifest, so every replica reaches the same decision.
 */
describe("Access control", () => {
    let node: TestNode; // node.identity = the creator ("A")
    let other: SigningIdentity; // a different, non-creator identity ("B")
    let otherController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("access-owner");
        other = await createIdentity("access-other", "pw", node.helia);
        otherController = new HeliaController(node.helia, other);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    async function createDb(name: string, isPublic = false) {
        return createDatabase<Value>(name, {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: isPublic ? "public" : "creator-only" },
        });
    }

    it("installs a real (non-empty) access policy in the manifest and lets the creator write", async () => {
        const db = await createDb("acc-default");
        const manifest = db.manifest;
        expect(manifest.consensus.access.equals(await emptyCID())).toBe(false);

        await db.set("k", { value: "v" });
        await db.waitUntilIdle();
        expect(await db.get("k")).toEqual({ value: "v" });
        await db.close();
    });

    it("rejects a local write from a non-creator identity", async () => {
        const db = await createDb("acc-reject-local");
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });

        await expect(dbAsB.set("k", { value: "v" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        expect(dbAsB.recordCount).toBe(0);

        await dbAsB.close();
        await db.close();
    });

    it("rejects a non-creator entry arriving through merge (not indexed)", async () => {
        const db = await createDb("acc-reject-merge");

        // A head bound to this database's manifest, whose leaf links an entry signed
        // by B. Authentication succeeds (B's signature is valid), but authorization
        // must reject it under the creator-only policy.
        const entry = await putSignedEntry(otherController, "intruder", { value: "x" }, Date.now(), db.address);
        const head = await buildHead(otherController, db.address, [
            { cid: entry.cid, creator: entry.creator, sort: [entry.timestamp], key: entry.key },
        ]);

        await db.syncNewHead(head.cid.bytes);
        await db.waitUntilIdle();

        expect(db.recordCount).toBe(0);
        expect(await db.get("intruder")).toBeUndefined();
        await db.close();
    });

    it("access: public allows a non-creator identity to write", async () => {
        const db = await createDb("acc-public", true);
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });

        await dbAsB.set("k", { value: "from B" });
        await dbAsB.waitUntilIdle();
        expect(await dbAsB.get("k")).toEqual({ value: "from B" });

        await dbAsB.close();
        await db.close();
    });

    it("open reads the policy from the signed manifest, ignoring local access options", async () => {
        // Database created creator-only; a peer opening it cannot loosen the policy by
        // passing an access preset locally (that would let replicas disagree — KNOWN_ISSUES #19).
        const db = await createDb("acc-no-local-override", false);
        const dbAsB = await openDatabase<Value>(db.address, {
            helia: node.helia,
            identity: other,
            consensus: { access: "public" },
        } as Parameters<typeof openDatabase<Value>>[1]);

        await expect(dbAsB.set("k", { value: "v" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await dbAsB.close();
        await db.close();
    });
});

describe("Access presets", () => {
    let node: TestNode; // node.identity = the creator
    let other: SigningIdentity;
    let otherController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("presets-owner");
        other = await createIdentity("presets-other", "pw", node.helia);
        otherController = new HeliaController(node.helia, other);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("prefix-per-writer: others write only under agents/<their-cid>/", async () => {
        const db = await createDatabase<Value>("acc-prefix", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: "prefix-per-writer" },
        });
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });
        const mine = `agents/${other.cid.toString()}/`;

        await db.set("anything/goes", { value: "creator" }); // the creator writes anywhere
        await dbAsB.set(`${mine}note`, { value: "mine" });
        await dbAsB.delete(`${mine}note`); // deletes obey the same rule
        await expect(dbAsB.set("free/key", { value: "x" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await expect(dbAsB.set(`agents/${node.identity.cid.toString()}/note`, { value: "x" })).rejects.toThrow(
            /access denied/i,
        );
        // A near-miss of the namespace (no separator) is not the namespace.
        await expect(dbAsB.set(`agents/${other.cid.toString()}x/note`, { value: "x" })).rejects.toThrow(
            /access denied/i,
        );
        await expect(dbAsB.delete("anything/goes")).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));

        // Merge path: B's signed entry outside its namespace is not indexed; inside it is.
        const outside = await putSignedEntry(otherController, "free/merged", { value: "x" }, Date.now(), db.address);
        const inside = await putSignedEntry(otherController, `${mine}merged`, { value: "ok" }, Date.now(), db.address);
        const head = await buildHead(otherController, db.address, [
            { cid: outside.cid, creator: outside.creator, sort: [outside.timestamp], key: outside.key },
            { cid: inside.cid, creator: inside.creator, sort: [inside.timestamp], key: inside.key },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await db.waitUntilIdle();
        expect(await db.get("free/merged")).toBeUndefined();
        expect(await db.get(`${mine}merged`)).toEqual({ value: "ok" });

        await dbAsB.close();
        await db.close();
    });

    it("allowlist: listed identities write, others are rejected locally and via merge", async () => {
        const db = await createDatabase<Value>("acc-allow", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: { allowlist: [node.identity.cid.toString(), other.cid.toString()] } },
        });
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });
        await dbAsB.set("b-key", { value: "allowed" });

        const third = await createIdentity("presets-third", "pw", node.helia);
        const dbAsC = await openDatabase<Value>(db.address, { helia: node.helia, identity: third });
        await expect(dbAsC.set("c-key", { value: "nope" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));

        const thirdController = new HeliaController(node.helia, third);
        const forged = await putSignedEntry(thirdController, "c-merge", { value: "nope" }, Date.now(), db.address);
        const head = await buildHead(thirdController, db.address, [
            { cid: forged.cid, creator: forged.creator, sort: [forged.timestamp], key: forged.key },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await db.waitUntilIdle();
        expect(await db.get("c-merge")).toBeUndefined();

        await dbAsC.close();
        await dbAsB.close();
        await db.close();
    });

    it("allowlist: refuses entries that are not identity CIDs", async () => {
        await expect(
            createDatabase<Value>("acc-allow-bad", {
                helia: node.helia,
                identity: node.identity,
                consensus: { access: { allowlist: ["not-a-cid"] } },
            }),
        ).rejects.toThrow(/allowlist/i);
    });


    it("namespace-per-writer: nobody, the creator included, writes outside its own namespace", async () => {
        const db = await createDatabase<Value>("acc-strict", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: "namespace-per-writer" },
        });
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });
        const creatorNs = `agents/${node.identity.cid.toString()}/`;
        const otherNs = `agents/${other.cid.toString()}/`;

        await db.set(`${creatorNs}decision`, { value: "creator" });
        await dbAsB.set(`${otherNs}finding`, { value: "b" });
        // The creator has no override: not outside its namespace, not in B's.
        await expect(db.set("shared/key", { value: "x" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await expect(db.set(`${otherNs}finding`, { value: "overwrite" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await expect(db.delete(`${otherNs}finding`)).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await expect(dbAsB.set(`${creatorNs}decision`, { value: "x" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));

        // Merge path: a creator-signed tombstone for B's key is not indexed.
        await dbAsB.waitUntilIdle();
        const creatorController = new HeliaController(node.helia, node.identity);
        const tomb = await putSignedTombstone(creatorController, `${otherNs}finding`, Date.now() + 10, db.address);
        await dbAsB.syncNewHead(
            (
                await buildHead(creatorController, db.address, [
                    { cid: tomb.cid, creator: tomb.creator, sort: [tomb.timestamp], key: tomb.key },
                ])
            ).cid.bytes,
        );
        await dbAsB.waitUntilIdle();
        expect(await dbAsB.get(`${otherNs}finding`)).toEqual({ value: "b" });

        await dbAsB.close();
        await db.close();
    });
});

describe("Writing as another identity (WriteOptions.identity)", () => {
    let node: TestNode; // node.identity = the device
    let agent: SigningIdentity;

    beforeAll(async () => {
        node = await createTestNode("signer-device");
        agent = await createIdentity("signer-device-codex", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("signs, authorizes and attributes the write to the given identity", async () => {
        const db = await createDatabase<Value>("signer-ns", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: "namespace-per-writer" },
        });
        const agentNs = `agents/${agent.cid.toString()}/`;
        const deviceNs = `agents/${node.identity.cid.toString()}/`;

        await db.set(`${agentNs}fact`, { value: "from the agent" }, { identity: agent });
        await db.set(`${deviceNs}fact`, { value: "from the device" }); // default signer unchanged
        expect((await db.provenance(`${agentNs}fact`))!.writer.equals(agent.cid)).toBe(true);
        expect((await db.provenance(`${deviceNs}fact`))!.writer.equals(node.identity.cid)).toBe(true);

        // Authorization is evaluated for the signing identity, not the database's own.
        await expect(db.set(`${deviceNs}x`, { value: "x" }, { identity: agent })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await expect(db.set(`${agentNs}x`, { value: "x" })).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await db.delete(`${agentNs}fact`, { identity: agent });
        expect(await db.get(`${agentNs}fact`)).toBeUndefined();
        expect((await db.provenance(`${agentNs}fact`))!.writer.equals(agent.cid)).toBe(true);

        // The agent's entries replicate like any other (merge path on a second replica).
        await db.set(`${agentNs}again`, { value: "replicated" }, { identity: agent });
        await db.waitUntilIdle();
        const replica = await openDatabase<Value>(db.address, {
            helia: node.helia,
            identity: node.identity,
            syncController: await createSyncController("signer-ns-replica", new HeliaController(node.helia, node.identity)),
        });
        await replica.syncNewHead((await db.createHead()).cid.bytes);
        await replica.waitUntilIdle();
        expect(await replica.get(`${agentNs}again`)).toEqual({ value: "replicated" });
        await replica.close();
        await db.close();
    });
});

describe("Custom policies and entryOperation", () => {
    let node: TestNode;
    let other: SigningIdentity;
    let otherController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("custom-policy-owner");
        other = await createIdentity("custom-policy-other", "pw", node.helia);
        otherController = new HeliaController(node.helia, other);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    // Anyone may put; only the database creator may delete.
    const onlyCreatorDeletes: PolicyDefinition = {
        version: 1,
        name: "puts-open-deletes-creator-only",
        description: "Any identity may put; only the creator may delete",
        logic: {
            or: [
                { "==": [{ var: "entryOperation" }, "put"] },
                { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
            ],
        } as unknown as PolicyRule,
    };

    it("a custom access policy can tell puts from deletes (local and merge path)", async () => {
        const db = await createDatabase<Value>("custom-deletes", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: { policy: onlyCreatorDeletes } },
        });
        const dbAsB = await openDatabase<Value>(db.address, { helia: node.helia, identity: other });

        await dbAsB.set("note", { value: "from b" });
        await expect(dbAsB.delete("note")).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED"));
        await db.set("creator-note", { value: "c" });
        await db.delete("creator-note"); // the creator may delete

        // Merge path: B's signed tombstone is rejected by the creator's replica.
        await dbAsB.waitUntilIdle();
        await db.syncNewHead((await dbAsB.createHead()).cid.bytes);
        await db.waitUntilIdle();
        expect(await db.get("note")).toEqual({ value: "from b" });
        const tomb = await putSignedTombstone(otherController, "note", Date.now() + 10, db.address);
        await db.syncNewHead(
            (
                await buildHead(otherController, db.address, [
                    { cid: tomb.cid, creator: tomb.creator, sort: [tomb.timestamp], key: tomb.key },
                ])
            ).cid.bytes,
        );
        await db.waitUntilIdle();
        expect(await db.get("note")).toEqual({ value: "from b" });

        const manifest = db.manifest;
        const reopened = await openDatabase<Value>(manifest.cid, { helia: node.helia, identity: other });
        await expect(reopened.delete("note")).rejects.toSatisfy((e) => isDenkmitError(e, "ACCESS_DENIED")); // the rule travels with the manifest
        await reopened.close();
        await dbAsB.close();
        await db.close();
    });

    it("a custom validation policy is enforced and sees entryOperation and entryKey", async () => {
        const db = await createDatabase<Value>("custom-validation", {
            helia: node.helia,
            identity: node.identity,
            consensus: {
                validity: {
                    version: 1,
                    name: "facts-only-no-deletes",
                    description: "Only facts/… keys; nothing is ever deleted",
                    logic: {
                        and: [
                            { startsWith: [{ var: "entryKey" }, "facts/"] },
                            { "==": [{ var: "entryOperation" }, "put"] },
                        ],
                    } as unknown as PolicyRule,
                },
            },
        });
        await db.set("facts/a", { value: "1" });
        await expect(db.set("notes/a", { value: "1" })).rejects.toSatisfy((e) => isDenkmitError(e, "VALIDITY_REJECTED"));
        await expect(db.delete("facts/a")).rejects.toSatisfy((e) => isDenkmitError(e, "VALIDITY_REJECTED"));
        expect(await db.get("facts/a")).toEqual({ value: "1" });
        await db.close();
    });

    it("refuses malformed custom policies, allowlist + policy, and removed options", async () => {
        const base = { helia: node.helia, identity: node.identity };
        await expect(
            createDatabase<Value>("custom-bad", {
                ...base,
                consensus: { access: { policy: { logic: true } as unknown as PolicyDefinition } },
            }),
        ).rejects.toThrow(/policy/i);
        await expect(
            createDatabase<Value>("custom-both", {
                ...base,
                consensus: { access: { allowlist: [node.identity.cid.toString()], policy: onlyCreatorDeletes } },
            } as unknown as Parameters<typeof createDatabase<Value>>[1]),
        ).rejects.toThrow(/allowlist.*policy/i);
        // Removed options are refused, not ignored: ignoring one would sign a
        // different, permanent manifest than intended.
        for (const removed of [{ access: "public" }, { accessPolicy: onlyCreatorDeletes }, { publicWrite: true }, { order: 2 }]) {
            await expect(
                createDatabase<Value>("removed", { ...base, ...removed } as unknown as Parameters<typeof createDatabase<Value>>[1]),
            ).rejects.toThrow(/was removed/);
        }
    });
});
