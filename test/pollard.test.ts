import * as codec from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { describe, expect, it } from "vitest";
import { createEmptyPollard, createLeaf, createPollard } from "../src/functions";
import { LeafTypes } from "../src/types";

async function cidOf(value: unknown): Promise<CID> {
    const bytes = codec.encode(value);
    return CID.createV1(codec.code, await sha256.digest(bytes));
}

describe("Pollard", () => {
    it("rejects orders outside (0, 8]", async () => {
        await expect(createEmptyPollard(0)).rejects.toThrow();
        await expect(createEmptyPollard(9)).rejects.toThrow();
    });

    it("creates an empty pollard with 2^order capacity", async () => {
        const pollard = await createEmptyPollard(3);
        expect(pollard.order).toBe(3);
        expect(pollard.maxLength).toBe(8);
        expect(pollard.length).toBe(0);
        expect(pollard.isFree()).toBe(true);
        expect(pollard.all()).toHaveLength(8);
        expect(pollard.all().every((leaf) => leaf.type === LeafTypes.Empty)).toBe(true);
    });

    it("appends leaves until full", async () => {
        const pollard = await createEmptyPollard(2);
        for (let i = 0; i < pollard.maxLength; i++) {
            expect(await pollard.append(LeafTypes.Pollard, await cidOf(i))).toBe(true);
            expect(pollard.length).toBe(i + 1);
        }
        expect(pollard.isFree()).toBe(false);
        expect(await pollard.append(LeafTypes.Pollard, await cidOf("overflow"))).toBe(false);
        expect(pollard.length).toBe(pollard.maxLength);
    });

    it("produces a deterministic CID for identical content", async () => {
        const a = await createEmptyPollard(3);
        const b = await createEmptyPollard(3);
        await a.append(LeafTypes.SortedEntry, await cidOf("x"), await cidOf("me"), [1], "k1");
        await b.append(LeafTypes.SortedEntry, await cidOf("x"), await cidOf("me"), [1], "k1");
        expect((await a.getCID()).equals(await b.getCID())).toBe(true);
    });

    it("changes CID when content changes", async () => {
        const a = await createEmptyPollard(3);
        const before = await a.getCID();
        await a.append(LeafTypes.Pollard, await cidOf("child"));
        const after = await a.getCID();
        expect(before.equals(after)).toBe(false);
    });

    it("round-trips through toJSON/createPollard with the same CID", async () => {
        const a = await createEmptyPollard(3);
        await a.append(LeafTypes.SortedEntry, await cidOf("v"), await cidOf("me"), [7], "key");
        const cid = await a.getCID();

        const b = await createPollard(a.toJSON());
        expect((await b.getCID()).equals(cid)).toBe(true);
    });

    it("compare() reports equal trees as equal", async () => {
        const a = await createEmptyPollard(2);
        const b = await createEmptyPollard(2);
        await a.append(LeafTypes.Pollard, await cidOf(1));
        await b.append(LeafTypes.Pollard, await cidOf(1));
        const { isEqual, difference } = await a.compare(b);
        expect(isEqual).toBe(true);
        expect(difference[0].every((leaf) => leaf.type === LeafTypes.Empty)).toBe(true);
    });

    it("compare() isolates differing leaves", async () => {
        const a = await createEmptyPollard(2);
        const b = await createEmptyPollard(2);
        const shared = await cidOf("shared");
        await a.append(LeafTypes.Pollard, shared);
        await b.append(LeafTypes.Pollard, shared);
        await a.append(LeafTypes.Pollard, await cidOf("only-in-a"));

        const { isEqual, difference } = await a.compare(b);
        expect(isEqual).toBe(false);

        const mineOnly = difference[0].filter((leaf) => leaf.type !== LeafTypes.Empty);
        const theirsOnly = difference[1].filter((leaf) => leaf.type !== LeafTypes.Empty);
        expect(mineOnly).toHaveLength(1);
        expect(mineOnly[0]).toMatchObject({ type: LeafTypes.Pollard, link: await cidOf("only-in-a") });
        expect(theirsOnly).toHaveLength(0);
    });

    it("compare() throws when orders differ", async () => {
        const a = await createEmptyPollard(2);
        const b = await createEmptyPollard(3);
        await expect(a.compare(b)).rejects.toThrow("Orders are different");
    });

    // KNOWN_ISSUES.md #7: the signature accepts `other?: PollardInterface` and the body
    // contains an `other || createEmptyPollard(...)` fallback, but the order check on the
    // line above dereferences `other?.order` first and throws, making the fallback dead code.
    it.fails("compare(undefined) should fall back to comparing against an empty pollard (known bug)", async () => {
        const a = await createEmptyPollard(2);
        await a.append(LeafTypes.Pollard, await cidOf("solo"));
        const { isEqual } = await a.compare();
        expect(isEqual).toBe(false);
    });

    it("getNode returns the root leaf at the top layer", async () => {
        const pollard = await createEmptyPollard(2);
        await pollard.append(LeafTypes.Pollard, await cidOf("n"));
        const root = await pollard.getNode(pollard.order, 0);
        expect(root.type).toBe(LeafTypes.Pollard);
        if (root.type === LeafTypes.Pollard) {
            expect(root.link.equals(await pollard.getCID())).toBe(true);
        }
    });

    it("toJSON throws while the tree is dirty", async () => {
        const pollard = await createEmptyPollard(2);
        await pollard.append(LeafTypes.Pollard, await cidOf("n"));
        pollard.addLeaf(createLeaf(LeafTypes.Pollard, await cidOf("dirty")));
        expect(() => pollard.toJSON()).toThrow();
    });
});
