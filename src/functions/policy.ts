import type { RulesLogic } from "json-logic-js";
import jsonLogic from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "../types/index.js";
import { PolicyData, PolicyInterface, PolicyVersionType } from "../types/policy.js";

export type PolicyInput = Record<string, number | string>;

// Deterministic custom operations available to manifest policies. Every replica
// registers the same set at module load, so evaluation stays a pure function of
// (manifest, signed entry) — the D1/D3 rule. Keep this list total and
// side-effect-free; never register anything that reads node-local state.
jsonLogic.add_operation("startsWith", (value: unknown, prefix: unknown): boolean => {
    return typeof value === "string" && typeof prefix === "string" && value.startsWith(prefix);
});

export class PolicyController implements PolicyInterface {
    version: PolicyVersionType;
    name: string;
    description: string;
    logic: RulesLogic;

    cid: CID;
    creator: CID;

    constructor(consensus: DenkmitData<PolicyData>) {
        this.version = consensus.data.version;
        this.name = consensus.data.name;
        this.description = consensus.data.description;
        this.logic = consensus.data.logic;
        this.cid = consensus.cid;
        this.creator = consensus.creator;
    }

    toJSON(): PolicyData {
        return {
            version: this.version,
            name: this.name,
            description: this.description,
            logic: this.logic,
        };
    }

    /**
     * Evaluates the policy. Strict: only a literal `true` result authorizes —
     * json-logic readily returns strings, numbers and arrays, and treating
     * truthiness as authorization would make a buggy policy fail open
     * (KNOWN_ISSUES.md #25).
     *
     * @param data - Deterministic inputs only (manifest + signed-entry data).
     * @returns Whether the policy accepts the input.
     */
    async execute(data: PolicyInput): Promise<boolean> {
        return jsonLogic.apply(this.logic, data) === true;
    }
}

export async function createPolicy(
    consensus: PolicyData,
    heliaController: HeliaControllerInterface,
): Promise<PolicyInterface> {
    const result = await heliaController.addSigned(consensus);
    return new PolicyController(result);
}

export async function fetchPolicy(
    cid: CID,
    heliaController: HeliaControllerInterface,
): Promise<PolicyInterface> {
    const result = await heliaController.getSigned<PolicyData>(cid);
    if (!result || !result.data) throw new Error("Consensus not found");
    return new PolicyController(result);
}
