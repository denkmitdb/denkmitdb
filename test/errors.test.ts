import * as jose from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    assertEntryPayload,
    assertManifestPayload,
    createDatabase,
    createIdentity,
    DenkmitError,
    fetchEntry,
    HeliaController,
    HeliaStorage,
    isDenkmitError,
    type ErrorCode,
} from "../src/internal";
import { createTestNode, type TestNode } from "./helpers";

/**
 * Error codes are API: every implementation raises the same code for the same
 * failure, so callers (and ports) match on `code`, never on messages.
 */
const code = (expected: ErrorCode) => (error: unknown) => isDenkmitError(error, expected);

describe("Error codes", () => {
    let node: TestNode;
    let controller: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("errors-tests");
        controller = new HeliaController(node.helia, node.identity);
    });
    afterAll(async () => {
        await node.stop();
    });

    it("DenkmitError is an Error with a stable code", () => {
        const error = new DenkmitError("NOT_FOUND", "x");
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("DenkmitError");
        expect(isDenkmitError(error)).toBe(true);
        expect(isDenkmitError(error, "NOT_FOUND")).toBe(true);
        expect(isDenkmitError(error, "MALFORMED")).toBe(false);
        expect(isDenkmitError(new Error("x"))).toBe(false);
    });

    it("INVALID_ARGUMENT for bad or removed options", async () => {
        const base = { helia: node.helia, identity: node.identity };
        await expect(createDatabase("bad-leaves", { ...base, subtreeLeaves: 3 })).rejects.toSatisfy(code("INVALID_ARGUMENT"));
        await expect(
            createDatabase("bad-preset", { ...base, consensus: { access: "everyone" as never } }),
        ).rejects.toSatisfy(code("INVALID_ARGUMENT"));
        await expect(
            createDatabase("removed", { ...base, access: "public" } as unknown as Parameters<typeof createDatabase>[1]),
        ).rejects.toSatisfy(code("INVALID_ARGUMENT"));
    });

    it("MALFORMED and UNSUPPORTED_VERSION for payloads", () => {
        expect(() => assertEntryPayload({ version: 9, key: "k", timestamp: 1, value: 1 })).toThrow(
            expect.objectContaining({ code: "UNSUPPORTED_VERSION" }),
        );
        expect(() => assertEntryPayload({ version: 1, key: 5, timestamp: 1, value: 1 })).toThrow(
            expect.objectContaining({ code: "MALFORMED" }),
        );
        expect(() => assertManifestPayload({ version: 3 })).toThrow(expect.objectContaining({ code: "UNSUPPORTED_VERSION" }));
    });

    it("MALFORMED for a block that is not a signed record", async () => {
        const cid = await controller.add({ not: "a jws" });
        await expect(fetchEntry(cid, controller)).rejects.toSatisfy(code("MALFORMED"));
    });

    it("INVALID_SIGNATURE for a record whose signature does not verify", async () => {
        const mallory = await createIdentity("errors-mallory", "pw", node.helia);
        // Signed by mallory, but claiming node.identity as its key id.
        const forged = await mallory.sign(HeliaStorage.encode({ version: 1, key: "k", timestamp: 1, value: 1 }));
        const header = jose.base64url.encode(JSON.stringify({ alg: "ES384", kid: node.identity.cid.toString() }));
        const cid = await controller.add({ ...forged, protected: header });
        await expect(fetchEntry(cid, controller)).rejects.toSatisfy(code("INVALID_SIGNATURE"));
    });
});
