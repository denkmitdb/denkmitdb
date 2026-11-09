import { DenkmitError } from "../errors.js";

/**
 * Policy languages, by the policy's `version` field. The version names the
 * language a rule is written in, so a later language can be added as a new version
 * while databases signed with an earlier one keep evaluating exactly as before. A
 * replica that does not know a policy's version refuses to open the database
 * (`UNSUPPORTED_VERSION`) instead of guessing.
 *
 * - 1 — **DenkMit Logic 1**: the subset of [JsonLogic](https://jsonlogic.com/)
 *   with the operators of {@link PolicyOperator} (`startsWith` is our own addition).
 */
export const POLICY_VERSION = 1;

/** Every policy language version this implementation evaluates. */
export const SUPPORTED_POLICY_VERSIONS: readonly number[] = [POLICY_VERSION];

/** An operator of DenkMit Logic 1 — a closed list. */
export type PolicyOperator =
    | "var"
    | "=="
    | "!="
    | "==="
    | "!=="
    | "!"
    | "!!"
    | "and"
    | "or"
    | "if"
    | "in"
    | "cat"
    | "startsWith"
    | "<"
    | "<="
    | ">"
    | ">=";

/**
 * The operators of DenkMit Logic 1. Everything else JsonLogic offers (arithmetic,
 * `substr`, `merge`, `map`/`reduce`, `log`, …) is refused when a database is
 * created and denies at evaluation, so every implementation needs exactly these.
 */
export const LOGIC_1_OPERATORS: readonly PolicyOperator[] = [
    "var",
    "==",
    "!=",
    "===",
    "!==",
    "!",
    "!!",
    "and",
    "or",
    "if",
    "in",
    "cat",
    "startsWith",
    "<",
    "<=",
    ">",
    ">=",
];

/** A literal in a rule. */
export type PolicyLiteral = string | number | boolean | null;

/**
 * A rule in DenkMit Logic 1: a literal, a list, or `{ operator: arguments }` with
 * exactly one operator, e.g. `{ "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] }`.
 */
export type PolicyRule =
    | PolicyLiteral
    | readonly PolicyRule[]
    | { readonly [K in PolicyOperator]?: PolicyRule | readonly PolicyRule[] };

/**
 * A policy, exactly as signed into a database — one of its consensus rules. Write
 * your own for `consensus.access` (`{ policy }`) or `consensus.validity`; the inputs
 * a rule sees are listed in docs/policies.md.
 */
export type PolicyDefinition = {
    /** The policy language: 1 = DenkMit Logic 1. */
    readonly version: 1;
    readonly name: string;
    readonly description: string;
    readonly logic: PolicyRule;
};

const OPERATORS: ReadonlySet<string> = new Set(LOGIC_1_OPERATORS);

/**
 * Why `rule` is not a DenkMit Logic 1 rule, or undefined when it is. Checks the
 * structure only (operators and literal types), not what a rule means.
 */
export function logic1Problem(rule: unknown, path = "logic"): string | undefined {
    if (rule === null || typeof rule === "string" || typeof rule === "boolean") return undefined;
    if (typeof rule === "number") return Number.isFinite(rule) ? undefined : `${path}: numbers must be finite`;
    if (Array.isArray(rule)) {
        for (let i = 0; i < rule.length; i++) {
            const problem = logic1Problem(rule[i], `${path}[${i}]`);
            if (problem) return problem;
        }
        return undefined;
    }
    if (typeof rule !== "object") return `${path}: ${typeof rule} is not a rule`;
    const keys = Object.keys(rule);
    if (keys.length !== 1) return `${path}: an operation has exactly one operator, found ${keys.length}`;
    const [operator] = keys;
    if (!OPERATORS.has(operator)) return `${path}: "${operator}" is not an operator of DenkMit Logic 1`;
    const args = (rule as Record<string, unknown>)[operator];
    if (operator === "var") {
        const name = Array.isArray(args) ? args[0] : args;
        if (typeof name !== "string") return `${path}.var: the variable name must be a string`;
        if (Array.isArray(args) && args.length > 2) return `${path}.var: at most a name and a default`;
    }
    return logic1Problem(args, `${path}.${operator}`);
}

/**
 * Checks a caller-supplied policy before it is signed into a manifest: a policy is
 * immutable once a database exists, so a malformed one must be refused up front.
 *
 * @param policy - The policy to check.
 * @param what - Which policy this is, for the error message.
 * @throws DenkmitError - `UNSUPPORTED_VERSION` for an unknown language version,
 *   `INVALID_ARGUMENT` for anything else that is not a well-formed policy.
 */
export function assertPolicyDefinition(policy: unknown, what: string): asserts policy is PolicyDefinition {
    const p = policy as Partial<PolicyDefinition> | null;
    if (typeof p !== "object" || p === null) throw new DenkmitError("INVALID_ARGUMENT", `${what} must be a policy object`);
    if (!SUPPORTED_POLICY_VERSIONS.includes(p.version as number)) {
        throw new DenkmitError(
            "UNSUPPORTED_VERSION",
            `${what}: policy language version ${String(p.version)} is not supported (supported: ${SUPPORTED_POLICY_VERSIONS.join(", ")})`,
        );
    }
    if (typeof p.name !== "string" || p.name.length === 0) throw new DenkmitError("INVALID_ARGUMENT", `${what} needs a name`);
    if (typeof p.description !== "string") throw new DenkmitError("INVALID_ARGUMENT", `${what} needs a description`);
    if (p.logic === undefined) throw new DenkmitError("INVALID_ARGUMENT", `${what} needs a rule in \`logic\``);
    const problem = logic1Problem(p.logic, `${what}.logic`);
    if (problem) throw new DenkmitError("INVALID_ARGUMENT", problem);
}
