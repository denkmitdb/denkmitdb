import * as jose from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDatabase,
    createIdentity,
    decryptValue,
    encryptedValueRecipients,
    encryptValueFor,
    EncryptedValue,
    EncryptionContext,
    isDenkmitError,
    fetchIdentity,
    HeliaStorage,
    isEncryptedValue,
    openDatabase,
} from "../src/internal";
import { SigningIdentity } from "../src/internal";
import { createTestNode, TestNode } from "./helpers";

/**
 * Private values in shared memory: a value encrypted to one or more recipient
 * identities replicates like any record — signed, provenance-attributed,
 * Merkle-synced — but only the recipients can read it.
 */
describe("Encrypted values", () => {
    let node: TestNode; // node.identity = alice (holds her private key)
    let bob: SigningIdentity;
    let carol: SigningIdentity;
    // Every envelope is bound to where it is published (database, key, writer).
    let ctx: EncryptionContext;

    beforeAll(async () => {
        node = await createTestNode("enc-alice");
        bob = await createIdentity("enc-bob", "pw", node.helia);
        carol = await createIdentity("enc-carol", "pw", node.helia);
        ctx = { database: "db-test", key: "agents/alice/k", writer: node.identity.cid.toString() };
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("round-trips a value encrypted to one recipient", async () => {
        const enc = await encryptValueFor(bob, { secret: "for bob", n: 42 }, ctx);
        expect(isEncryptedValue(enc)).toBe(true);
        expect(encryptedValueRecipients(enc)).toEqual([bob.cid.toString()]);
        expect(await decryptValue(bob, enc, ctx)).toEqual({ secret: "for bob", n: 42 });
    });

    it("every listed recipient can decrypt; a non-recipient (even the sender) cannot", async () => {
        const enc = await encryptValueFor([bob, carol], { shared: "bob and carol" }, ctx);
        expect(new Set(encryptedValueRecipients(enc))).toEqual(new Set([bob.cid.toString(), carol.cid.toString()]));
        expect(await decryptValue(bob, enc, ctx)).toEqual({ shared: "bob and carol" });
        expect(await decryptValue(carol, enc, ctx)).toEqual({ shared: "bob and carol" });
        expect(await decryptValue(node.identity, enc, ctx)).toBeUndefined();
    });

    it("encrypts to a FETCHED identity (public key only) — the sender never needs the private key", async () => {
        const bobPublic = await fetchIdentity(bob.cid, node.helia);
        const enc = await encryptValueFor(bobPublic, { secret: "remote" }, ctx);
        expect(await decryptValue(bob, enc, ctx)).toEqual({ secret: "remote" });
    });

    it("duplicate recipients are folded and an empty recipient list is refused", async () => {
        const enc = await encryptValueFor([bob, bob, carol], 1, ctx);
        expect(encryptedValueRecipients(enc)).toHaveLength(2);
        await expect(encryptValueFor([], 1, ctx)).rejects.toThrow(/recipient/i);
    });

    it("tampered ciphertext or a foreign envelope decrypts to undefined, never throws", async () => {
        const enc = await encryptValueFor(bob, { secret: "x" }, ctx);
        const tampered: EncryptedValue = {
            ...enc,
            jwe: { ...enc.jwe, ciphertext: enc.jwe.ciphertext.replace(/^./, (c) => (c === "A" ? "B" : "A")) },
        };
        expect(await decryptValue(bob, tampered, ctx)).toBeUndefined();
        expect(isEncryptedValue({ secret: "plain" })).toBe(false);
        expect(isEncryptedValue({ denkmitEncrypted: 1 })).toBe(false);
        expect(await decryptValue(bob, { denkmitEncrypted: 1 } as unknown as EncryptedValue, ctx)).toBeUndefined();
    });

    it("malformed envelopes are rejected instead of breaking reads", async () => {
        const bad = [
            { denkmitEncrypted: 1, jwe: { ciphertext: "", recipients: [null] } },
            { denkmitEncrypted: 1, jwe: { ciphertext: "", recipients: [{ header: 5 }] } },
            { denkmitEncrypted: 1, jwe: { ciphertext: "", iv: "", tag: "", recipients: [] } },
        ];
        for (const value of bad) {
            expect(isEncryptedValue(value)).toBe(false);
            expect(() => encryptedValueRecipients(value as unknown as EncryptedValue)).not.toThrow();
            expect(await decryptValue(bob, value as unknown as EncryptedValue, ctx)).toBeUndefined();
        }
    });

    it("only the advertised suite is accepted (ECDH-ES+A256KW / A256GCM)", async () => {
        const jwk = HeliaStorage.decode<jose.JWK>(Buffer.from(bob.publicKey, "base64"));
        const key = (await jose.importJWK({ ...jwk, alg: "ECDH-ES+A128KW" }, "ECDH-ES+A128KW")) as CryptoKey;
        const general = await new jose.GeneralEncrypt(HeliaStorage.encode({ weak: true }))
            .setProtectedHeader({ enc: "A128GCM" })
            .addRecipient(key)
            .setUnprotectedHeader({ alg: "ECDH-ES+A128KW", kid: bob.cid.toString() })
            .encrypt();
        expect(await decryptValue(bob, { denkmitEncrypted: 1, jwe: general }, ctx)).toBeUndefined();
    });

    it("a context-bound envelope opens only in its own context (replay is detected)", async () => {
        const context = { database: "db-1", key: "agents/alice/x", writer: node.identity.cid.toString() };
        const enc = await encryptValueFor(bob, { secret: "bound" }, context);
        expect(await decryptValue(bob, enc, context)).toEqual({ secret: "bound" });
        // Re-posted by someone else, under another key, or into another database: refused.
        expect(await decryptValue(bob, enc, { ...context, writer: carol.cid.toString() })).toBeUndefined();
        expect(await decryptValue(bob, enc, { ...context, key: "agents/carol/x" })).toBeUndefined();
        expect(await decryptValue(bob, enc, { ...context, database: "db-2" })).toBeUndefined();
        // An envelope sealed without a context (built by hand: the API always binds one)
        // never opens.
        const jwk = HeliaStorage.decode<jose.JWK>(Buffer.from(bob.publicKey, "base64"));
        const key = (await jose.importJWK({ ...jwk, alg: "ECDH-ES+A256KW" }, "ECDH-ES+A256KW")) as CryptoKey;
        const unbound = await new jose.GeneralEncrypt(HeliaStorage.encode(1))
            .setProtectedHeader({ enc: "A256GCM" })
            .addRecipient(key)
            .setUnprotectedHeader({ alg: "ECDH-ES+A256KW", kid: bob.cid.toString() })
            .encrypt();
        expect(await decryptValue(bob, { denkmitEncrypted: 1, jwe: unbound }, context)).toBeUndefined();
    });

    it("refuses to encrypt or decrypt without a complete context", async () => {
        const missing = undefined as unknown as EncryptionContext;
        await expect(encryptValueFor(bob, 1, missing)).rejects.toSatisfy((e) => isDenkmitError(e, "INVALID_ARGUMENT"));
        await expect(encryptValueFor(bob, 1, { ...ctx, key: "" })).rejects.toSatisfy((e) =>
            isDenkmitError(e, "INVALID_ARGUMENT"),
        );
        const enc = await encryptValueFor(bob, 1, ctx);
        await expect(decryptValue(bob, enc, missing)).rejects.toSatisfy((e) => isDenkmitError(e, "INVALID_ARGUMENT"));
    });

    it("an encrypted value replicates through the database like any value", async () => {
        const db = await createDatabase<EncryptedValue>("enc-db", {
            helia: node.helia,
            identity: node.identity,
            consensus: { access: "public" },
        });
        const where = { database: db.address.toString(), key: "private/token", writer: node.identity.cid.toString() };
        await db.set("private/token", await encryptValueFor([node.identity, bob], { secret: "stored" }, where));
        await db.waitUntilIdle();

        const asBob = await openDatabase<EncryptedValue>(db.address, { helia: node.helia, identity: bob });
        await asBob.syncNewHead((await db.createHead()).cid.bytes);
        await asBob.waitUntilIdle();

        const stored = await asBob.get("private/token");
        expect(isEncryptedValue(stored)).toBe(true);
        // Provenance still attributes it to alice; alice and bob can open it, carol cannot.
        const writer = (await asBob.provenance("private/token"))!.writer;
        expect(writer.equals(node.identity.cid)).toBe(true);
        const read = { database: asBob.address.toString(), key: "private/token", writer: writer.toString() };
        expect(await decryptValue(bob, stored!, read)).toEqual({ secret: "stored" });
        expect(await decryptValue(node.identity, stored!, read)).toEqual({ secret: "stored" });
        expect(await decryptValue(carol, stored!, read)).toBeUndefined();

        await asBob.close();
        await db.close();
    });
});
