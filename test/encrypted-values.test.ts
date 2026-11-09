import * as jose from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    createDatabase,
    createIdentity,
    decryptValue,
    encryptedRecipients,
    encryptValueFor,
    EncryptedValue,
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

    beforeAll(async () => {
        node = await createTestNode("enc-alice");
        bob = await createIdentity("enc-bob", "pw", node.helia);
        carol = await createIdentity("enc-carol", "pw", node.helia);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    it("round-trips a value encrypted to one recipient", async () => {
        const enc = await encryptValueFor(bob, { secret: "for bob", n: 42 });
        expect(isEncryptedValue(enc)).toBe(true);
        expect(encryptedRecipients(enc)).toEqual([bob.cid.toString()]);
        expect(await decryptValue(bob, enc)).toEqual({ secret: "for bob", n: 42 });
    });

    it("every listed recipient can decrypt; a non-recipient (even the sender) cannot", async () => {
        const enc = await encryptValueFor([bob, carol], { shared: "bob and carol" });
        expect(new Set(encryptedRecipients(enc))).toEqual(new Set([bob.cid.toString(), carol.cid.toString()]));
        expect(await decryptValue(bob, enc)).toEqual({ shared: "bob and carol" });
        expect(await decryptValue(carol, enc)).toEqual({ shared: "bob and carol" });
        expect(await decryptValue(node.identity, enc)).toBeUndefined();
    });

    it("encrypts to a FETCHED identity (public key only) — the sender never needs the private key", async () => {
        const bobPublic = await fetchIdentity(bob.cid, node.helia);
        const enc = await encryptValueFor(bobPublic, { secret: "remote" });
        expect(await decryptValue(bob, enc)).toEqual({ secret: "remote" });
    });

    it("duplicate recipients are folded and an empty recipient list is refused", async () => {
        const enc = await encryptValueFor([bob, bob, carol], 1);
        expect(encryptedRecipients(enc)).toHaveLength(2);
        await expect(encryptValueFor([], 1)).rejects.toThrow(/recipient/i);
    });

    it("tampered ciphertext or a foreign envelope decrypts to undefined, never throws", async () => {
        const enc = await encryptValueFor(bob, { secret: "x" });
        const tampered: EncryptedValue = {
            ...enc,
            jwe: { ...enc.jwe, ciphertext: enc.jwe.ciphertext.replace(/^./, (c) => (c === "A" ? "B" : "A")) },
        };
        expect(await decryptValue(bob, tampered)).toBeUndefined();
        expect(isEncryptedValue({ secret: "plain" })).toBe(false);
        expect(isEncryptedValue({ denkmitEncrypted: 1 })).toBe(false);
        expect(await decryptValue(bob, { denkmitEncrypted: 1 } as unknown as EncryptedValue)).toBeUndefined();
    });

    it("malformed envelopes are rejected instead of breaking reads", async () => {
        const bad = [
            { denkmitEncrypted: 1, jwe: { ciphertext: "", recipients: [null] } },
            { denkmitEncrypted: 1, jwe: { ciphertext: "", recipients: [{ header: 5 }] } },
            { denkmitEncrypted: 1, jwe: { ciphertext: "", iv: "", tag: "", recipients: [] } },
        ];
        for (const value of bad) {
            expect(isEncryptedValue(value)).toBe(false);
            expect(() => encryptedRecipients(value as unknown as EncryptedValue)).not.toThrow();
            expect(await decryptValue(bob, value as unknown as EncryptedValue)).toBeUndefined();
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
        expect(await decryptValue(bob, { denkmitEncrypted: 1, jwe: general })).toBeUndefined();
    });

    it("a context-bound envelope opens only in its own context (replay is detected)", async () => {
        const context = { database: "db-1", key: "agents/alice/x", writer: node.identity.cid.toString() };
        const enc = await encryptValueFor(bob, { secret: "bound" }, context);
        expect(await decryptValue(bob, enc, context)).toEqual({ secret: "bound" });
        // Re-posted by someone else, under another key, or into another database: refused.
        expect(await decryptValue(bob, enc, { ...context, writer: carol.cid.toString() })).toBeUndefined();
        expect(await decryptValue(bob, enc, { ...context, key: "agents/carol/x" })).toBeUndefined();
        expect(await decryptValue(bob, enc, { ...context, database: "db-2" })).toBeUndefined();
        // An unbound envelope cannot satisfy an expected context either.
        expect(await decryptValue(bob, await encryptValueFor(bob, 1), context)).toBeUndefined();
    });

    it("an encrypted value replicates through the database like any value", async () => {
        const db = await createDatabase<EncryptedValue>("enc-db", {
            helia: node.helia,
            identity: node.identity,
            access: "public",
        });
        await db.set("private/token", await encryptValueFor([node.identity, bob], { secret: "stored" }));
        await db.idle();

        const asBob = await openDatabase<EncryptedValue>(db.address, { helia: node.helia, identity: bob });
        await asBob.syncNewHead((await db.createHead()).cid.bytes);
        await asBob.idle();

        const stored = await asBob.get("private/token");
        expect(isEncryptedValue(stored)).toBe(true);
        // Provenance still attributes it to alice; alice and bob can open it, carol cannot.
        expect((await asBob.provenance("private/token"))!.creator.equals(node.identity.cid)).toBe(true);
        expect(await decryptValue(bob, stored!)).toEqual({ secret: "stored" });
        expect(await decryptValue(node.identity, stored!)).toEqual({ secret: "stored" });
        expect(await decryptValue(carol, stored!)).toBeUndefined();

        await asBob.close();
        await db.close();
    });
});
