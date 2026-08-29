# Encrypted Values Implementation Plan (Part D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Private facts in shared memory: a value encrypted to a recipient identity replicates like any record — signed, provenance-attributed, Merkle-synced — but only the recipient can read it.

**Architecture:** Zero core-storage changes: an encrypted value is just a JSON-serializable JWE object stored as the value of a normal entry. `Identity.encrypt` (ECDH-ES+A256KW → A256GCM to the identity's own public key) and `Identity.decrypt` already exist and are tested; this plan adds two value-level helper functions on top (encode value → encrypt → JWE; decrypt → decode) plus recipient-identity resolution by CID (`fetchIdentity` already fetches + verifies any identity block). Sender flow: fetch the recipient's identity by CID, `encryptValueFor(recipient, value)`, `db.set(key, jwe)`. Recipient flow: `db.get(key)` → `decryptValue(myIdentity, jwe)`.

**Tech Stack:** `jose` 6 (already a dependency — `FlattenedJWE`), dag-cbor encode/decode via `HeliaStorage`, vitest.

**Spec:** `VISION.md` step "Encrypted values — the primitive already exists": "shared memory where peers replicate facts they cannot read." Constraint from `src/functions/entry.ts`: values must be dag-cbor-serializable (a FlattenedJWE is a plain object of strings — it is).

## Global Constraints

- Node ≥22, ESM, TS strict, pnpm workspace; all gates green (zero-warning lint, typecheck, build, test, test:package, mcp build+smoke).
- Additive API only → part of v3.1.0.
- No key-management scope creep: one recipient per value, no group keys, no rotation — YAGNI until users ask.

---

### Task D1: `encryptValueFor` / `decryptValue` helpers

**Files:**
- Modify: `src/functions/identity.ts` (two exported functions at the bottom), `src/functions/index.ts` (exports — check whether identity.ts exports are re-exported wholesale; if so nothing to add)
- Test: `test/encrypted-values.test.ts`

**Interfaces:**
- Consumes: `IdentityInterface.encrypt(data: Uint8Array): Promise<jose.FlattenedJWE>` and `.decrypt(jwe): Promise<Uint8Array | boolean>` (existing); `HeliaStorage.encode/decode` (existing statics); `fetchIdentity(cid, heliaStorage)` (existing).
- Produces:
  - `export async function encryptValueFor(recipient: IdentityInterface, value: unknown): Promise<jose.FlattenedJWE>`
  - `export async function decryptValue<T>(identity: IdentityInterface, jwe: jose.FlattenedJWE): Promise<T | undefined>` — `undefined` when this identity is not the recipient or the JWE is invalid.

- [ ] **Step 1: Write the failing test** (`test/encrypted-values.test.ts`)

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as jose from "jose";
import {
    createDenkmitDatabase,
    createIdentity,
    decryptValue,
    encryptValueFor,
    fetchIdentity,
    HeliaStorage,
    openDenkmitDatabase,
} from "../src/functions";
import { IdentityInterface } from "../src/types";
import { createTestNode, TestNode } from "./helpers";

describe("Encrypted values", () => {
    let node: TestNode; // node.identity = alice (has her private key)
    let bob: IdentityInterface; // bob's full identity (private key present)

    beforeAll(async () => {
        node = await createTestNode("enc-alice");
        bob = await createIdentity("enc-bob", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("round-trips a value encrypted to a recipient", async () => {
        const jwe = await encryptValueFor(bob, { secret: "for bob", n: 42 });
        const plain = await decryptValue<{ secret: string; n: number }>(bob, jwe);
        expect(plain).toEqual({ secret: "for bob", n: 42 });
    });

    it("a non-recipient (even the sender) cannot decrypt", async () => {
        const jwe = await encryptValueFor(bob, { secret: "x" });
        expect(await decryptValue(node.identity, jwe)).toBeUndefined();
    });

    it("encrypting to a FETCHED identity (public key only) works — the sender never needs the private key", async () => {
        // Re-resolve bob from his stored identity block, as a remote peer would.
        const storage = new HeliaStorage(node.helia);
        const bobPublic = await fetchIdentity(bob.cid, storage);
        const jwe = await encryptValueFor(bobPublic, { secret: "remote" });
        expect(await decryptValue(bob, jwe)).toEqual({ secret: "remote" });
    });

    it("an encrypted value replicates through the database like any value", async () => {
        const db = await createDenkmitDatabase<jose.FlattenedJWE>("enc-db", {
            helia: node.helia,
            identity: node.identity,
        });
        const jwe = await encryptValueFor(bob, { secret: "stored" });
        await db.set("private/bob/token", jwe);
        await db.idle();

        // A second instance (bob's view over the same helia) reads the record…
        const asBob = await openDenkmitDatabase<jose.FlattenedJWE>(db.address, {
            helia: node.helia,
            identity: bob,
        });
        const head = await db.createHead();
        await asBob.syncNewHead(head.cid.bytes);
        await asBob.idle();

        const stored = await asBob.get("private/bob/token");
        expect(stored).toBeDefined();
        // …provenance still attributes it to alice, and only bob can open it.
        const prov = await asBob.provenance("private/bob/token");
        expect(prov!.creator.equals(node.identity.cid)).toBe(true);
        expect(await decryptValue(bob, stored!)).toEqual({ secret: "stored" });
        expect(await decryptValue(node.identity, stored!)).toBeUndefined();

        await asBob.close();
        await db.close();
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/encrypted-values.test.ts`
Expected: FAIL — `encryptValueFor` / `decryptValue` not exported. (If `HeliaStorage` or `fetchIdentity` are not currently exported from `src/functions/index.ts`, note it — Step 3 fixes exports.)

- [ ] **Step 3: Implement** — append to `src/functions/identity.ts`:

```typescript
/**
 * Encrypts a JSON-serializable value to a recipient identity: dag-cbor-encodes
 * the value and wraps it in a Flattened JWE (ECDH-ES+A256KW → A256GCM) that
 * only the holder of the recipient's private key can open. The result is a
 * plain object of strings — storable as a normal database value, so it
 * replicates signed and provenance-attributed like any record, while peers
 * relay ciphertext they cannot read. The recipient can be a fetched identity
 * (public key only); the sender never needs the recipient's private key.
 *
 * @param recipient - The identity to encrypt to (e.g. from `fetchIdentity`).
 * @param value - Any dag-cbor-serializable value.
 * @returns The JWE to store as the entry's value.
 */
export async function encryptValueFor(recipient: IdentityInterface, value: unknown): Promise<jose.FlattenedJWE> {
    return await recipient.encrypt(HeliaStorage.encode(value));
}

/**
 * Decrypts a value produced by {@link encryptValueFor} with this identity's
 * private key. Returns `undefined` when this identity is not the recipient
 * (kid mismatch), the private key is unavailable, or the JWE is invalid —
 * never throws, so callers can probe records without try/catch.
 *
 * @param identity - The recipient identity (private key required).
 * @param jwe - The stored JWE value.
 * @returns The decoded value, or undefined.
 */
export async function decryptValue<T>(identity: IdentityInterface, jwe: jose.FlattenedJWE): Promise<T | undefined> {
    try {
        const plaintext = await identity.decrypt(jwe);
        if (plaintext === false || !(plaintext instanceof Uint8Array)) return undefined;
        return HeliaStorage.decode<T>(plaintext);
    } catch {
        return undefined;
    }
}
```

Check `src/functions/index.ts`: it re-exports modules wholesale (`export * from "./identity.js"` style) — if identity exports are enumerated instead, add `encryptValueFor`, `decryptValue`. Ensure `fetchIdentity` and `HeliaStorage` are reachable from the package index (they are today via the utils/identity re-exports; verify with the test import).

- [ ] **Step 4: Run tests to verify pass, then full gates**

Run: `npx vitest run test/encrypted-values.test.ts && npx vitest run && npm run typecheck`
Expected: all pass. Note: `Identity.decrypt` throws "Key ID does not match identity ID" for a non-recipient — the helper's catch converts that to `undefined` (test 2 covers it).

- [ ] **Step 5: Commit**

```bash
git add src/functions/identity.ts src/functions/index.ts test/encrypted-values.test.ts
git commit -m "identity: encryptValueFor/decryptValue — private facts in shared memory"
```

### Task D2: Documentation

**Files:**
- Modify: `README.md` (Features bullet + a short "Private values" subsection under Usage), `CHANGELOG.md`, `VISION.md` (mark step done)

**Interfaces:** none (docs only).

- [ ] **Step 1: README** — Features bullet: `**Private values**: encrypt a value to a recipient identity (`encryptValueFor`/`decryptValue`) — peers replicate signed ciphertext they cannot read.` Usage subsection after the retrieve step:

````markdown
6. **Private values** (optional) — encrypt to a recipient; peers replicate what they cannot read:

    ```typescript
    import { encryptValueFor, decryptValue, fetchIdentity, HeliaStorage } from "@denkmitdb/denkmitdb";

    const bob = await fetchIdentity(bobIdentityCid, new HeliaStorage(helia)); // public key only
    await db.set("private/bob/token", await encryptValueFor(bob, { apiKey: "…" }));

    // on bob's node:
    const secret = await decryptValue(myIdentity, (await db.get("private/bob/token"))!);
    ```
````

(Renumber the existing "Close Database" step accordingly.)

- [ ] **Step 2: CHANGELOG + VISION** — `[Unreleased]`: "Private values: `encryptValueFor`/`decryptValue` — ECDH-ES JWE per value, replicates as normal signed records; recipients resolve by identity CID." In `VISION.md`, change the sequence line `8. Encrypted values.` to `8. ~~Encrypted values~~ — shipped (encryptValueFor/decryptValue).`

- [ ] **Step 3: Gates**

Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:package`
Expected: green (package smoke re-verifies the new exports import cleanly from the packed tarball).

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md VISION.md
git commit -m "docs: private values (encryptValueFor/decryptValue)"
```

## Self-Review Notes

- Spec coverage: "replicate facts they cannot read" ✓ (test 4 proves storage+provenance+non-recipient-opacity), "primitive already exists" honored ✓ (zero changes to Identity/encrypt/decrypt — helpers only).
- Type consistency: `encryptValueFor(recipient: IdentityInterface, value: unknown)` / `decryptValue<T>(identity, jwe)` used identically in tests, impl, README.
- Deliberately out: MCP tool surface for encryption (agents can call the library or a future `memory_set_encrypted` — wait for demand), multi-recipient, key rotation.
