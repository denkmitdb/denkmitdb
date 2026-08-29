# Policy Hardening + Namespace ACLs Implementation Plan (Part B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the policy engine's input surface deterministic and key-aware, then ship access presets (creator-only / public / prefix-per-writer / allowlist) with a policy cookbook.

**Architecture:** Policies stay json-logic programs stored in the signed manifest, evaluated identically on the local-write path (`set`/`delete`) and the merge path (`processLeafMerging`). This plan (1) registers one deterministic custom operation (`startsWith`), (2) adds `entryKey` to the policy input and removes the two node-local fields that let a custom policy diverge replicas, (3) replaces the boolean `publicWrite` with an `access` preset that compiles to a policy at create time. Wire format is untouched — presets are just `PolicyData` values.

**Tech Stack:** `json-logic-js` 2.x (`add_operation`), existing `PolicyController`, vitest.

**Spec:** `VISION.md` section "The third axis: policy" (honest-audit items 1–2) and `ROADMAP.md` post-v2 step 5. Determinism rule (D1/D3, `specs/ordering.md`): acceptance must be a pure function of manifest + signed-entry data.

## Global Constraints

- Node ≥22, ESM, TS strict, pnpm workspace; all gates green (`lint` zero-warning, `typecheck`, `build`, `test`, `test:package`, mcp `build`+`smoke`).
- **Determinism:** nothing node-local (`Date.now()`, local identity) may reach a replicated policy's inputs.
- Published API: additive changes → v3.1.0; note the validation-input change in CHANGELOG under a "Changed" heading (built-in policies unaffected — both ship `logic: true` or creator-equality, which never read the removed fields).
- `publicWrite` keeps working (deprecated alias for `access: "public"`).

---

### Task B1: `startsWith` operation + strict boolean policy results

**Files:**
- Modify: `src/functions/policy.ts`
- Test: `test/policy.test.ts` (append)

**Interfaces:**
- Produces: json-logic programs may use `{"startsWith": [str, prefix]}`; `PolicyController.execute()` returns `true` only for a literal `true` result (truthy non-booleans no longer pass).

- [ ] **Step 1: Write the failing tests** (append to `test/policy.test.ts`)

```typescript
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
});

it("execute() is strictly boolean — truthy non-true results do not authorize", async () => {
    const policy = await createPolicy(
        { version: 1, name: "truthy", description: "returns a string", logic: { cat: ["a", "b"] } as unknown as RulesLogic },
        heliaController,
    );
    expect(await policy.execute({})).toBe(false);
});
```

(`RulesLogic` is already imported in `src/functions/policy.ts`; in the test file import it from `json-logic-js`. Reuse the file's existing `heliaController` fixture.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/policy.test.ts`
Expected: FAIL — `startsWith` unknown operation / truthy string passes.

- [ ] **Step 3: Implement in `src/functions/policy.ts`**

Below the imports, before the class:

```typescript
// Deterministic custom operations available to manifest policies. Every replica
// registers the same set at module load, so evaluation stays a pure function of
// (manifest, signed entry) — the D1/D3 rule. Keep this list total and
// side-effect-free; never register anything that reads node-local state.
jsonLogic.add_operation("startsWith", (value: unknown, prefix: unknown): boolean => {
    return typeof value === "string" && typeof prefix === "string" && value.startsWith(prefix);
});
```

And change `execute`:

```typescript
    async execute(data: PolicyInput): Promise<boolean> {
        // Strict: only a literal `true` authorizes. json-logic happily returns
        // strings/numbers; treating truthiness as authorization would make a
        // buggy policy fail open.
        return jsonLogic.apply(this.logic, data) === true;
    }
```

- [ ] **Step 4: Run tests to verify pass, plus the full suite** (existing built-ins return literal `true`/`false`, so nothing else moves)

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/functions/policy.ts test/policy.test.ts
git commit -m "policy: startsWith operation + strict boolean execute()"
```

### Task B2: Key-aware, deterministic policy inputs + `access` presets

**Files:**
- Modify: `src/types/denkmitdb.ts` (options type), `src/functions/denkmitdb.ts` (`accessPolicyRule`, `isAuthorized`, `set`, `delete`, `processLeafMerging`, `createDenkmitDatabase`)
- Test: `test/access.test.ts` (append a new describe block)

**Interfaces:**
- Consumes: `startsWith` from Task B1.
- Produces:
  - `export type AccessPreset = "creator-only" | "public" | "prefix-per-writer" | { allowlist: string[] };` in `src/types/denkmitdb.ts`, exported from the package index (it re-exports the types module).
  - `DenkmitDatabaseOptions.access?: AccessPreset` (create only; `publicWrite` deprecated alias).
  - `private isAuthorized(entryCreator: CID, entryKey: string)` — access-policy input is `{ entryCreator, databaseCreator, entryKey }`.
  - Validation-policy input shrinks to `{ databaseCreator, entryTimestamp, entryCreator, entryKey }` (node-local `currentTimestamp`/`currentIdentity` removed).
  - Prefix rule: non-creators may write only under `agents/<their-identity-cid>/`.

- [ ] **Step 1: Write the failing tests** (append to `test/access.test.ts`; the file already has `node` = creator, `other` identity, `otherController`, and `createDb`)

```typescript
describe("Access presets", () => {
    it("prefix-per-writer: others write only under agents/<their-cid>/", async () => {
        const db = await createDenkmitDatabase<Value>("acc-prefix", {
            helia: node.helia,
            identity: node.identity,
            access: "prefix-per-writer",
        });
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });

        // creator writes anywhere
        await db.set("anything/goes", { value: "creator" });
        // B writes in B's own namespace
        await dbAsB.set(`agents/${other.cid.toString()}/note`, { value: "mine" });
        // B may NOT write outside it, nor in the creator's namespace
        await expect(dbAsB.set("free/key", { value: "x" })).rejects.toThrow(/access denied/i);
        await expect(
            dbAsB.set(`agents/${node.identity.cid.toString()}/note`, { value: "x" }),
        ).rejects.toThrow(/access denied/i);

        await dbAsB.close();
        await db.close();
    });

    it("allowlist: listed identities write, others are rejected locally and via merge", async () => {
        const db = await createDenkmitDatabase<Value>("acc-allow", {
            helia: node.helia,
            identity: node.identity,
            access: { allowlist: [node.identity.cid.toString(), other.cid.toString()] },
        });
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });
        await dbAsB.set("b-key", { value: "allowed" });

        const third = await createIdentity("acc-third", "pw", node.helia);
        const dbAsC = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: third });
        await expect(dbAsC.set("c-key", { value: "nope" })).rejects.toThrow(/access denied/i);

        // merge path: a forged head carrying an entry signed by the unlisted
        // identity must not be indexed (same helpers as the existing merge test).
        const thirdController = new HeliaController(node.helia, third);
        const forged = await putSignedEntry(thirdController, "c-merge", { value: "nope" }, Date.now());
        const head = await buildHead(thirdController, db.address, [
            { cid: forged.cid, creator: forged.creator, sort: [forged.timestamp], key: forged.key },
        ]);
        await db.syncNewHead(head.cid.bytes);
        await db.idle();
        expect(await db.get("c-merge")).toBeUndefined();

        await dbAsC.close();
        await dbAsB.close();
        await db.close();
    });

    it("publicWrite: true still works as a deprecated alias for access: public", async () => {
        const db = await createDenkmitDatabase<Value>("acc-alias", {
            helia: node.helia,
            identity: node.identity,
            publicWrite: true,
        });
        const dbAsB = await openDenkmitDatabase<Value>(db.address, { helia: node.helia, identity: other });
        await dbAsB.set("open", { value: "ok" });
        await dbAsB.close();
        await db.close();
    });
});
```

(Add `putSignedEntry`, `buildHead` to the helpers import and `HeliaController` to the functions import at the top of `test/access.test.ts` if not present.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/access.test.ts`
Expected: FAIL — `access` option unknown.

- [ ] **Step 3: Implement the type** in `src/types/denkmitdb.ts`

Above `DenkmitDatabaseOptions`:

```typescript
/**
 * Access preset for a NEW database (create only — open always reads the policy
 * from the signed manifest). Compiles to a json-logic access policy:
 * - "creator-only" (default): only the creating identity writes.
 * - "public": any identity writes (provenance still attributes every record).
 * - "prefix-per-writer": the creator writes anywhere; any other identity writes
 *   only under `agents/<its-identity-cid>/…`.
 * - { allowlist }: exactly the listed identity CIDs write.
 */
export type AccessPreset = "creator-only" | "public" | "prefix-per-writer" | { allowlist: string[] };
```

and inside `DenkmitDatabaseOptions`, next to `publicWrite`:

```typescript
    access?: AccessPreset;
```

- [ ] **Step 4: Implement in `src/functions/denkmitdb.ts`**

Replace `accessPolicyRule(publicWrite: boolean)` with:

```typescript
/**
 * Compiles an access preset to the json-logic access policy stored in the
 * manifest. Inputs available to the rule: entryCreator, databaseCreator,
 * entryKey — all taken from the signed entry / manifest, never node-local
 * (D1/D3), so every replica reaches the same verdict.
 */
function accessPolicyRule(access: AccessPreset): PolicyData {
    if (access === "public") {
        return { version: 1, name: "denkmit-access-public", description: "Any identity may write", logic: true };
    }
    if (access === "prefix-per-writer") {
        return {
            version: 1,
            name: "denkmit-access-prefix-per-writer",
            description: "Creator writes anywhere; others only under agents/<their-cid>/",
            logic: {
                or: [
                    { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
                    { startsWith: [{ var: "entryKey" }, { cat: ["agents/", { var: "entryCreator" }, "/"] }] },
                ],
            } as unknown as RulesLogic,
        };
    }
    if (typeof access === "object") {
        return {
            version: 1,
            name: "denkmit-access-allowlist",
            description: "Only listed identities may write",
            logic: { in: [{ var: "entryCreator" }, access.allowlist] } as unknown as RulesLogic,
        };
    }
    return {
        version: 1,
        name: "denkmit-access-creator-only",
        description: "Only the database creator may write",
        logic: { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
    };
}
```

(Import `RulesLogic` type from `json-logic-js` and `AccessPreset` from the types index.) In `createDenkmitDatabase`, resolve the preset — `publicWrite` stays as a deprecated alias:

```typescript
    const access: AccessPreset = options.access ?? (options.publicWrite ? "public" : "creator-only");
    const accessPolicy = await createPolicy(accessPolicyRule(access), heliaController);
```

Change `isAuthorized`:

```typescript
    private async isAuthorized(entryCreator: CID, entryKey: string): Promise<boolean> {
        return this.accessPolicy.execute({
            entryCreator: entryCreator.toString(),
            databaseCreator: this.manifest.creator.toString(),
            entryKey,
        });
    }
```

Update the three call sites: `set()` / `delete()` → `this.isAuthorized(this.identity.cid, key)`; `processLeafMerging` → `this.isAuthorized(creator, key)`. In both `set()` and `delete()` and `processLeafMerging`, shrink the validation check object to:

```typescript
        const check = {
            databaseCreator: this.manifest.creator.toString(),
            entryTimestamp: entry.timestamp, // in processLeafMerging: timestamp
            entryCreator: entry.creator.toString(), // in processLeafMerging: creator.toString()
            entryKey: key,
        };
```

(Delete the `currentTimestamp`/`currentIdentity` lines — they are the node-local divergence footgun VISION.md documents.)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run && npm run typecheck`
Expected: all pass (including the new describe block).

- [ ] **Step 6: Commit**

```bash
git add src/types/denkmitdb.ts src/functions/denkmitdb.ts test/access.test.ts
git commit -m "policy: key-aware deterministic inputs + access presets (prefix-per-writer, allowlist)"
```

### Task B3: Policy cookbook + MCP `DENKMIT_ACCESS` + CHANGELOG

**Files:**
- Create: `docs/policies.md`
- Modify: `mcp/src/node.ts` (config + create call), `mcp/README.md` (env table + write-access note), `README.md` (docs table row), `CHANGELOG.md`

**Interfaces:**
- Consumes: `AccessPreset` from Task B2.
- Produces: `DENKMIT_ACCESS` env (`creator-only` | `public` | `prefix-per-writer`) on the MCP server.

- [ ] **Step 1: Write `docs/policies.md`**

```markdown
# Policy cookbook

A DenkMitDB manifest embeds two json-logic programs — **access** (who may
write) and **validation** — signed, content-addressed, and evaluated
identically by every replica at ingest. Rules see only deterministic inputs:

| Input | Meaning |
|---|---|
| `entryCreator` | identity CID of the entry's signer (verified) |
| `databaseCreator` | identity CID of the manifest's signer |
| `entryKey` | the key being written |
| `entryTimestamp` | the signed entry's timestamp (validation policy only) |

Custom operations available (registered identically on every replica):
`startsWith(value, prefix)`. Policies are **total functions** — json-logic has
no loops, so evaluation always terminates; a result other than literal `true`
denies.

## Presets (`access` option on `createDenkmitDatabase`)

### creator-only (default)
```json
{ "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] }
```

### public
```json
true
```
Any identity writes; provenance still attributes every record to its signer.

### prefix-per-writer
```json
{ "or": [
    { "==": [{ "var": "entryCreator" }, { "var": "databaseCreator" }] },
    { "startsWith": [{ "var": "entryKey" },
        { "cat": ["agents/", { "var": "entryCreator" }, "/"] }] }
] }
```
The creator writes anywhere; every other identity owns exactly its
`agents/<identity-cid>/…` namespace. Same-key races between agents become
structurally impossible.

### allowlist
```json
{ "in": [{ "var": "entryCreator" }, ["<cid-1>", "<cid-2>"]] }
```
Shared memory for exactly these N identities.

## Rules of the road

- **Determinism is the contract.** A policy must be a pure function of the
  inputs above. There is deliberately no wall-clock, no local identity, no
  randomness — a rule depending on them would make replicas disagree about
  which entries exist (see `specs/ordering.md` §4).
- Policies are **immutable** — fixed at create time in the signed manifest.
  Auditable forever; to change the rules, create a new database. (Delegation
  entries are on the roadmap.)
```

- [ ] **Step 2: Wire `DENKMIT_ACCESS` in `mcp/src/node.ts`**

In `MemoryNodeConfig` add `access: "creator-only" | "public" | "prefix-per-writer";` and in `configFromEnv`:

```typescript
        access:
            env.DENKMIT_ACCESS === "public" || env.DENKMIT_PUBLIC_WRITE === "true"
                ? "public"
                : env.DENKMIT_ACCESS === "prefix-per-writer"
                  ? "prefix-per-writer"
                  : "creator-only",
```

and in the create call replace `publicWrite: config.publicWrite` with `access: config.access` (drop the `publicWrite` field from the config type). Update `mcp/README.md`: env table row `DENKMIT_ACCESS` (default `creator-only`; `DENKMIT_PUBLIC_WRITE=true` remains a deprecated alias for `public`), and extend the "Write access" note with the `prefix-per-writer` fleet recommendation.

- [ ] **Step 3: CHANGELOG + README docs row**

CHANGELOG `[Unreleased]`: an "Access presets & policy hardening" entry — additive `access` option, `startsWith`, strict-boolean `execute()`, and a **Changed** note: validation policies no longer receive `currentTimestamp`/`currentIdentity` (built-ins unaffected; the fields were a replica-divergence hazard). README docs table: add `| [docs/policies.md](docs/policies.md) | Policy cookbook: presets, inputs, determinism rules |`.

- [ ] **Step 4: Full gates + mcp smoke**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:package && cd mcp && pnpm build && pnpm smoke`
Expected: all green (smoke-sync still uses `DENKMIT_PUBLIC_WRITE=true` — the alias keeps it working).

- [ ] **Step 5: Commit**

```bash
git add docs/policies.md mcp/src/node.ts mcp/README.md README.md CHANGELOG.md
git commit -m "policy: cookbook, DENKMIT_ACCESS presets for mcp, changelog"
```

## Self-Review Notes

- Spec coverage: VISION audit item 1 (`entryKey`) → B2; item 2 (node-local fields) → B2; cookbook → B3; strict boolean (fail-open hazard) → B1. Item 3 (delegation) is explicitly deferred — roadmap, not this plan.
- Type consistency: `isAuthorized(entryCreator: CID, entryKey: string)` used identically at all three call sites; `AccessPreset` name is uniform across types/functions/mcp.
- Determinism: `startsWith` and `cat` are pure; allowlist arrays are literals in the signed manifest.
