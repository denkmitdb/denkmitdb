import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIdentity, fetchIdentity, hasIdentity, openIdentity, HeliaStorage } from "../src/functions";
import { createTestNode, TestNode } from "./helpers";

describe("Identity", () => {
    let node: TestNode;

    beforeAll(async () => {
        node = await createTestNode("identity-tests");
    });

    afterAll(async () => {
        await node.stop();
    });

    it("creates an identity and stores it in the datastore", async () => {
        expect(await hasIdentity("identity-tests", node.helia)).toBe(true);
        expect(node.identity.name).toBe("identity-tests");
        expect(node.identity.alg).toBe("ES384");
        expect(node.identity.cid).toBeDefined();
    });

    it("refuses to create a duplicate identity", async () => {
        await expect(createIdentity("identity-tests", "other", node.helia)).rejects.toThrow(
            "Identity already exists",
        );
    });

    it("opens an existing identity with the right passphrase", async () => {
        const reopened = await openIdentity("identity-tests", "test-passphrase", node.helia);
        expect(reopened.cid.equals(node.identity.cid)).toBe(true);

        const payload = new Uint8Array([1, 2, 3]);
        const jws = await reopened.sign(payload);
        expect(await reopened.verify(jws)).toEqual(payload);
    });

    it("rejects the wrong passphrase", async () => {
        await expect(openIdentity("identity-tests", "wrong", node.helia)).rejects.toThrow();
    });

    it("throws when opening an unknown identity", async () => {
        await expect(openIdentity("nobody", "pass", node.helia)).rejects.toThrow("Identity not found");
    });

    it("signs and verifies data", async () => {
        const payload = HeliaStorage.encode({ hello: "world" });
        const jws = await node.identity.sign(payload);
        const verified = await node.identity.verify(jws);
        expect(verified).toEqual(payload);
    });

    it("returns undefined for a tampered signature", async () => {
        const jws = await node.identity.sign(new Uint8Array([1, 2, 3]));
        const tampered = { ...jws, payload: "AAAA" };
        expect(await node.identity.verify(tampered)).toBeUndefined();
    });

    it("encrypts and decrypts data with its own keys", async () => {
        const secret = new Uint8Array([4, 5, 6]);
        const jwe = await node.identity.encrypt(secret);
        const plaintext = await node.identity.decrypt(jwe);
        expect(plaintext).not.toBe(false);
        // May come back as a Buffer in Node; compare the byte content.
        expect(new Uint8Array(plaintext as Uint8Array)).toEqual(secret);
    });

    it("fetchIdentity retrieves a verifiable public identity from the network", async () => {
        const fetched = await fetchIdentity(node.identity.cid, new HeliaStorage(node.helia));
        expect(fetched.name).toBe("identity-tests");
        expect(fetched.cid.equals(node.identity.cid)).toBe(true);

        // Public identity can verify signatures but cannot sign (no private key).
        const jws = await node.identity.sign(new Uint8Array([7]));
        expect(await fetched.verify(jws)).toEqual(new Uint8Array([7]));
        await expect(fetched.sign(new Uint8Array([8]))).rejects.toThrow("Private key is not available");
    });
});
