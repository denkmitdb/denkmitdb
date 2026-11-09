import type { RulesLogic } from "json-logic-js";
import jsonLogic from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "../types/index.js";
import { POLICY_VERSION, PolicyData, PolicyInterface, PolicyVersionType } from "../types/policy.js";

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
        try {
            return jsonLogic.apply(this.logic, data) === true;
        } catch {
            // A rule that throws (unknown operation, bad arguments) denies. The same
            // rule throws identically on every replica, so this stays deterministic,
            // and a broken policy can never abort ingestion of a whole head.
            return false;
        }
    }
}

/**
 * Checks a caller-supplied policy before it is signed into a manifest: a policy is
 * immutable once a database exists, so a malformed one must be refused up front.
 *
 * @param policy - The policy data to check.
 * @param what - Which policy this is, for the error message.
 * @throws Error - If the policy is not a well-formed v1 json-logic policy.
 */
export function assertPolicyData(policy: unknown, what: string): asserts policy is PolicyData {
    const p = policy as Partial<PolicyData> | null;
    if (typeof p !== "object" || p === null) throw new Error(`${what} must be a policy object`);
    if (p.version !== POLICY_VERSION) throw new Error(`${what} must have version ${POLICY_VERSION}`);
    if (typeof p.name !== "string" || p.name.length === 0) throw new Error(`${what} needs a name`);
    if (typeof p.description !== "string") throw new Error(`${what} needs a description`);
    if (p.logic === undefined) throw new Error(`${what} needs json-logic \`logic\``);
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
