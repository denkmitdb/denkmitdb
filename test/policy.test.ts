import type { RulesLogic } from "json-logic-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPolicy, fetchPolicy, HeliaController } from "../src/functions";
import { PolicyData } from "../src/types";
import { createTestNode, TestNode } from "./helpers";

describe("PolicyController", () => {
    let node: TestNode;
    let heliaController: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("consensus-tests");
        heliaController = new HeliaController(node.helia, node.identity);
    });

    afterAll(async () => {
        await node.stop();
    });

    it("evaluates a real json-logic rule against entry metadata", async () => {
        const consensus: PolicyData = {
            version: 1,
            name: "entry-not-from-future",
            description: "Entry timestamps must not be ahead of the local clock",
            logic: { "<=": [{ var: "entryTimestamp" }, { var: "currentTimestamp" }] },
        };
        const controller = await createPolicy(consensus, heliaController);

        expect(await controller.execute({ entryTimestamp: 100, currentTimestamp: 200 })).toBe(true);
        expect(await controller.execute({ entryTimestamp: 300, currentTimestamp: 200 })).toBe(false);
    });

    it("round-trips through the store: fetchPolicy returns the same rule", async () => {
        const consensus: PolicyData = {
            version: 1,
            name: "creator-only",
            description: "Only the database creator may write",
            logic: { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
        };
        const created = await createPolicy(consensus, heliaController);
        const fetched = await fetchPolicy(created.cid, heliaController);

        expect(fetched.name).toBe("creator-only");
        expect(fetched.logic).toEqual(consensus.logic);
        expect(await fetched.execute({ entryCreator: "a", databaseCreator: "a" })).toBe(true);
        expect(await fetched.execute({ entryCreator: "b", databaseCreator: "a" })).toBe(false);
    });

    it("documents the default database rule: `logic: true` accepts every write", async () => {
        // This is what createDenkmitDatabase installs today (see ARCHITECTURE.md and
        // KNOWN_ISSUES.md D1): the default "consensus" is a constant-true predicate,
        // i.e. the database is world-writable until a real rule is supplied.
        const consensus: PolicyData = {
            version: 1,
            name: "denkmit-timestamp",
            description: "Consensus for denkmit database timestamp",
            logic: true,
        };
        const controller = await createPolicy(consensus, heliaController);
        expect(await controller.execute({ anything: "goes" })).toBe(true);
    });

    it("supports the deterministic startsWith operation", async () => {
        const policy = await createPolicy(
            {
                version: 1,
                name: "prefix-test",
                description: "startsWith works",
                logic: { startsWith: [{ var: "entryKey" }, "agents/"] } as unknown as RulesLogic,
            },
            heliaController,
        );
        expect(await policy.execute({ entryKey: "agents/abc/x" })).toBe(true);
        expect(await policy.execute({ entryKey: "notes/abc" })).toBe(false);
        // Non-strings never match (no coercion of numbers or missing vars).
        expect(await policy.execute({ entryKey: 7 })).toBe(false);
        expect(await policy.execute({})).toBe(false);
    });

    it("a rule that throws denies instead of throwing", async () => {
        const policy = await createPolicy(
            {
                version: 1,
                name: "broken",
                description: "uses an operation no replica registers",
                logic: { noSuchOperation: [1] } as unknown as RulesLogic,
            },
            heliaController,
        );
        await expect(policy.execute({})).resolves.toBe(false);
    });
});
