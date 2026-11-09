import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDatabase,
    createManifest,
    createPolicy,
    evaluatePolicy,
    fetchPolicy,
    HeliaController,
    isDenkmitError,
    KEY_VALUE_DATABASE_TYPE,
    logic1Problem,
    MANIFEST_VERSION,
    openDatabase,
    type ErrorCode,
    type PolicyDefinition,
    type PolicyRule,
} from "../src/internal";
import { createTestNode, type TestNode } from "./helpers";

/**
 * Policy languages are versioned by the policy's `version`: 1 = DenkMit Logic 1,
 * a closed subset of JsonLogic. Rules outside it are refused at creation and deny
 * at evaluation; an unknown language version is refused, never guessed.
 */
const code = (expected: ErrorCode) => (error: unknown) => isDenkmitError(error, expected);
const policy = (logic: unknown, version = 1): PolicyDefinition =>
    ({ version, name: "t", description: "t", logic }) as unknown as PolicyDefinition;

describe("Policy language (DenkMit Logic 1)", () => {
    let node: TestNode;
    let controller: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("policy-language");
        controller = new HeliaController(node.helia, node.identity);
    });
    afterAll(async () => {
        await node.stop();
    });

    it("every preset stays within the language", async () => {
        for (const access of ["creator-only", "public", "prefix-per-writer", "namespace-per-writer"] as const) {
            const db = await createDatabase(`preset-${access}`, { helia: node.helia, identity: node.identity, consensus: { access } });
            expect(logic1Problem(db.consensus.access.logic)).toBeUndefined();
            expect(logic1Problem(db.consensus.validity.logic)).toBeUndefined();
            await db.close();
        }
    });

    it("refuses operators outside the language when a database is created", async () => {
        const base = { helia: node.helia, identity: node.identity };
        for (const logic of [{ "+": [1, 1] }, { substr: ["abc", 1] }, { log: "x" }, { "==": [1, 1], "!=": [1, 2] }]) {
            await expect(
                createDatabase("bad-op", { ...base, consensus: { access: { policy: policy(logic) } } }),
            ).rejects.toSatisfy(code("INVALID_ARGUMENT"));
        }
        await expect(
            createDatabase("bad-var", { ...base, consensus: { validity: policy({ var: 5 }) } }),
        ).rejects.toSatisfy(code("INVALID_ARGUMENT"));
    });

    it("refuses an unknown language version at creation", async () => {
        await expect(
            createDatabase("v2", { helia: node.helia, identity: node.identity, consensus: { validity: policy(true, 2) } }),
        ).rejects.toSatisfy(code("UNSUPPORTED_VERSION"));
    });

    it("a rule outside the language denies at evaluation, even where JsonLogic would accept", () => {
        const outside = policy({ "==": [{ "+": [1, 1] }, 2] });
        expect(evaluatePolicy(outside, {})).toBe(false);
        const inside: PolicyRule = { startsWith: [{ var: "entryKey" }, "facts/"] };
        expect(evaluatePolicy(policy(inside), { entryKey: "facts/x" })).toBe(true);
    });

    it("a database whose policy uses an unknown language version does not open", async () => {
        // Signed directly (bypassing createDatabase's checks), as a future version would be.
        const future = await createPolicy(policy(true, 2), controller);
        await expect(fetchPolicy(future.cid, controller)).rejects.toSatisfy(code("UNSUPPORTED_VERSION"));
        const access = await createPolicy(policy(true), controller);
        const manifest = await createManifest(
            {
                version: MANIFEST_VERSION,
                name: "future",
                type: KEY_VALUE_DATABASE_TYPE,
                order: 3,
                consensus: future.cid,
                access: access.cid,
                timestamp: Date.now(),
            },
            controller,
        );
        await expect(openDatabase(manifest.cid, { helia: node.helia, identity: node.identity })).rejects.toSatisfy(
            code("UNSUPPORTED_VERSION"),
        );
    });
});
