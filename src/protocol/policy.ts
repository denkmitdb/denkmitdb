import type { RulesLogic } from "json-logic-js";

export const POLICY_VERSION = 1;

/**
 * A json-logic policy, exactly as signed into a database. Write your own for
 * `accessPolicy` / `validationPolicy`; the inputs available to the rule are listed
 * in docs/policies.md.
 */
export type PolicyDefinition = {
    /** Policy format version; always 1. */
    readonly version: 1;
    readonly name: string;
    readonly description: string;
    readonly logic: RulesLogic;
};

/**
 * Checks a caller-supplied policy before it is signed into a manifest: a policy is
 * immutable once a database exists, so a malformed one must be refused up front.
 *
 * @param policy - The policy to check.
 * @param what - Which policy this is, for the error message.
 * @throws Error - If the policy is not a well-formed v1 json-logic policy.
 */
export function assertPolicyDefinition(policy: unknown, what: string): asserts policy is PolicyDefinition {
    const p = policy as Partial<PolicyDefinition> | null;
    if (typeof p !== "object" || p === null) throw new Error(`${what} must be a policy object`);
    if (p.version !== POLICY_VERSION) throw new Error(`${what} must have version ${POLICY_VERSION}`);
    if (typeof p.name !== "string" || p.name.length === 0) throw new Error(`${what} needs a name`);
    if (typeof p.description !== "string") throw new Error(`${what} needs a description`);
    if (p.logic === undefined) throw new Error(`${what} needs json-logic \`logic\``);
}
