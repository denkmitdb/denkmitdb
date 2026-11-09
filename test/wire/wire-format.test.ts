/**
 * Guards the wire format across the public-API refactor: see wire-flows.ts.
 * If this fails, the refactor changed bytes on the wire — fix the code, never
 * the fixture (wire-v4.json).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CID } from "multiformats/cid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    fetchEntry,
    fetchHead,
    fetchIdentity,
    fetchManifest,
    fetchPolicy,
    HeliaController,
    openDatabase,
} from "../../src/internal";
import type { SigningIdentity } from "../../src/internal";
import { createTestNode, type TestNode } from "../helpers";
import { installCaptured, runDeterministicFlows, type CapturedBlocks, type DeterministicRecord } from "./wire-flows";

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "wire-v4.json"), "utf8")) as {
    captured: CapturedBlocks;
    deterministic: DeterministicRecord;
};
const { captured, deterministic } = fixture;
const cid = (s: string) => CID.parse(s);

describe("wire format v4", () => {
    let node: TestNode;
    let identity: SigningIdentity;
    let controller: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("wire-test");
        identity = await installCaptured(node.helia, captured);
        controller = new HeliaController(node.helia, identity);
    });
    afterAll(async () => {
        await node.stop();
    });

    it("restores the fixture identity from its captured block and key", () => {
        expect(identity.cid.toString()).toBe(captured.identity.cid);
    });

    it("produces byte-identical payloads and CIDs for the same writes", async () => {
        const fresh = await createTestNode("wire-test-deterministic");
        try {
            const fixed = await installCaptured(fresh.helia, captured);
            const got = await runDeterministicFlows(fresh.helia, fixed);
            expect(got.cids).toEqual(deterministic.cids);
            expect(got.payloads.length).toBe(deterministic.payloads.length);
            got.payloads.forEach((hex, i) => expect(hex, `payload #${i}`).toBe(deterministic.payloads[i]));
        } finally {
            await fresh.stop();
        }
    });

    it("decodes a captured v2 entry, v1 entry and tombstone", async () => {
        const v2 = await fetchEntry<unknown>(cid(captured.refs.entryV2), controller);
        expect(v2.version).toBe(2);
        expect(v2.manifest?.toString()).toBe(captured.refs.manifestV2);
        expect(v2.key).toBe(captured.expect.entryV2.key);
        expect(v2.value).toEqual(captured.expect.entryV2.value);
        expect(v2.timestamp).toBe(captured.expect.entryV2.timestamp);
        expect(v2.creator.toString()).toBe(captured.identity.cid);

        const v1 = await fetchEntry<unknown>(cid(captured.refs.entryV1), controller);
        expect(v1.version).toBe(1);
        expect(v1.manifest).toBeUndefined();
        expect(v1.key).toBe(captured.expect.entryV1.key);
        expect(v1.value).toEqual(captured.expect.entryV1.value);

        const tomb = await fetchEntry<unknown>(cid(captured.refs.tombstone), controller);
        expect(tomb.deleted).toBe(true);
        expect(tomb.key).toBe(captured.expect.tombstoneKey);
        expect(tomb.value).toBeUndefined();
    });

    it("decodes captured v2 and legacy v1 manifests, a policy, a head and an identity", async () => {
        const m2 = await fetchManifest(cid(captured.refs.manifestV2), controller);
        expect(m2.version).toBe(2);
        expect(m2.name).toBe(captured.expect.manifestV2Name);
        expect(m2.consensus.access.toString()).toBe(captured.refs.policy);

        const m1 = await fetchManifest(cid(captured.refs.manifestV1), controller);
        expect(m1.version).toBe(1);
        expect(m1.name).toBe("wire-legacy");
        expect(m1.subtreeLeaves).toBe(8);

        const policy = await fetchPolicy(cid(captured.refs.policy), controller);
        expect(policy.name).toBe("denkmit-access-namespace-per-writer");

        const head = await fetchHead(cid(captured.refs.head), controller);
        expect(head.manifest.toString()).toBe(captured.refs.manifestV2);

        const fetched = await fetchIdentity(captured.identity.cid, node.helia);
        expect(fetched.cid.toString()).toBe(captured.identity.cid);
    });

    it("opens the captured database and reads its values", async () => {
        const db = await openDatabase<unknown>(cid(captured.refs.manifestV2), {
            helia: node.helia,
            identity,
        });
        try {
            await db.load(await fetchHead(cid(captured.refs.head), controller));
            const values: Record<string, unknown> = {};
            for await (const [k, v] of db.entries()) values[k] = v;
            expect(values).toEqual(captured.expect.dbValues);
            expect(await db.get(captured.expect.tombstoneKey)).toBeUndefined();
        } finally {
            await db.close();
        }
    });
});
