import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConsensus, fetchConsensus, HeliaController } from "../src/functions";
import { ConsensusData } from "../src/types";
import { createTestNode, TestNode } from "./helpers";

describe("ConsensusController", () => {
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
        const consensus: ConsensusData = {
            version: 1,
            name: "entry-not-from-future",
            description: "Entry timestamps must not be ahead of the local clock",
            logic: { "<=": [{ var: "entryTimestamp" }, { var: "currentTimestamp" }] },
        };
        const controller = await createConsensus(consensus, heliaController);

        expect(await controller.execute({ entryTimestamp: 100, currentTimestamp: 200 })).toBe(true);
        expect(await controller.execute({ entryTimestamp: 300, currentTimestamp: 200 })).toBe(false);
    });

    it("round-trips through the store: fetchConsensus returns the same rule", async () => {
        const consensus: ConsensusData = {
            version: 1,
            name: "creator-only",
            description: "Only the database creator may write",
            logic: { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
        };
        const created = await createConsensus(consensus, heliaController);
        const fetched = await fetchConsensus(created.cid, heliaController);

        expect(fetched.name).toBe("creator-only");
        expect(fetched.logic).toEqual(consensus.logic);
        expect(await fetched.execute({ entryCreator: "a", databaseCreator: "a" })).toBe(true);
        expect(await fetched.execute({ entryCreator: "b", databaseCreator: "a" })).toBe(false);
    });

    it("documents the default database rule: `logic: true` accepts every write", async () => {
        // This is what createDenkmitDatabase installs today (see ARCHITECTURE.md and
        // KNOWN_ISSUES.md D1): the default "consensus" is a constant-true predicate,
        // i.e. the database is world-writable until a real rule is supplied.
        const consensus: ConsensusData = {
            version: 1,
            name: "denkmit-timestamp",
            description: "Consensus for denkmit database timestamp",
            logic: true,
        };
        const controller = await createConsensus(consensus, heliaController);
        expect(await controller.execute({ anything: "goes" })).toBe(true);
    });
});
