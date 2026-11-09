import jsonLogic from "json-logic-js";
import { CID } from "multiformats/cid";
import type { PolicyDefinition } from "./protocol/policy.js";
import type { Signed } from "./protocol/signed.js";
import type { HeliaController } from "./storage/helia.js";
import type { SignedPolicy } from "./types.js";

/** Deterministic inputs a policy is evaluated over (docs/policies.md). */
export type PolicyInput = Record<string, number | string>;

// Deterministic custom operations available to manifest policies. Every replica
// registers the same set at module load, so evaluation stays a pure function of
// (manifest, signed entry) — the D1/D3 rule. Keep this list total and
// side-effect-free; never register anything that reads node-local state.
jsonLogic.add_operation("startsWith", (value: unknown, prefix: unknown): boolean => {
    return typeof value === "string" && typeof prefix === "string" && value.startsWith(prefix);
});

/**
 * Evaluates a policy. Strict: only a literal `true` result authorizes — json-logic
 * readily returns strings, numbers and arrays, and treating truthiness as
 * authorization would make a buggy policy fail open (KNOWN_ISSUES.md #25). A rule
 * that throws (unknown operation, bad arguments) denies; it throws identically on
 * every replica, so this stays deterministic.
 *
 * @param policy - The policy to evaluate.
 * @param input - Deterministic inputs only (manifest + signed-entry data).
 */
export function evaluatePolicy(policy: PolicyDefinition, input: PolicyInput): boolean {
    try {
        return jsonLogic.apply(policy.logic, input) === true;
    } catch {
        return false;
    }
}

function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

/**
 * The runtime policy is a frozen copy: the rule that authorizes writes must not be
 * changeable through `db.policies` (that would make this replica disagree with its
 * peers while the signed policy CID stays the same), and freezing must not touch
 * the caller's own definition object.
 */
function toPolicy(signed: Signed<PolicyDefinition>): SignedPolicy {
    const { version, name, description, logic } = signed.data;
    return Object.freeze({
        version,
        name,
        description,
        logic: deepFreeze(structuredClone(logic)),
        cid: signed.cid,
        creator: signed.creator,
    });
}

/** Signs and stores a policy. */
export async function createPolicy(definition: PolicyDefinition, controller: HeliaController): Promise<SignedPolicy> {
    return toPolicy(await controller.addSigned(definition));
}

/** Fetches and verifies a policy. */
export async function fetchPolicy(cid: CID, controller: HeliaController): Promise<SignedPolicy> {
    const result = await controller.getSigned<PolicyDefinition>(cid);
    if (!result) throw new Error("Policy not found");
    return toPolicy(result);
}
