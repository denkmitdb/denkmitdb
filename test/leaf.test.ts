import * as codec from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { describe, expect, it } from "vitest";
import { createLeaf, isLeavesEqual } from "../src/functions";
import { LeafTypes } from "../src/types";

async function cidOf(value: unknown): Promise<CID> {
    const bytes = codec.encode(value);
    return CID.createV1(codec.code, await sha256.digest(bytes));
}

const cidA = await cidOf("a");
const cidB = await cidOf("b");

describe("createLeaf", () => {
    it("creates an empty leaf by default", () => {
        expect(createLeaf()).toEqual({ type: LeafTypes.Empty });
        expect(createLeaf(LeafTypes.Empty)).toEqual({ type: LeafTypes.Empty });
    });

    it("creates a hash leaf", () => {
        const hash = new Uint8Array([1, 2, 3]);
        expect(createLeaf(LeafTypes.Hash, hash)).toEqual({ type: LeafTypes.Hash, hash });
    });

    it("creates a pollard leaf holding a CID link", () => {
        expect(createLeaf(LeafTypes.Pollard, cidA)).toEqual({ type: LeafTypes.Pollard, link: cidA });
    });

    it("creates a sorted-entry leaf with sort key, key and creator", () => {
        const leaf = createLeaf(LeafTypes.SortedEntry, cidA, cidB, [42], "answer");
        expect(leaf).toEqual({ type: LeafTypes.SortedEntry, link: cidA, creator: cidB, sort: [42], key: "answer" });
    });
});

describe("isLeavesEqual", () => {
    it("treats two empty leaves as equal", () => {
        expect(isLeavesEqual(createLeaf(), createLeaf())).toBe(true);
    });

    it("compares hash leaves by content", () => {
        const a = createLeaf(LeafTypes.Hash, new Uint8Array([1, 2, 3]));
        const b = createLeaf(LeafTypes.Hash, new Uint8Array([1, 2, 3]));
        const c = createLeaf(LeafTypes.Hash, new Uint8Array([9, 9, 9]));
        expect(isLeavesEqual(a, b)).toBe(true);
        expect(isLeavesEqual(a, c)).toBe(false);
    });

    it("compares linked leaves by CID bytes", () => {
        expect(isLeavesEqual(createLeaf(LeafTypes.Pollard, cidA), createLeaf(LeafTypes.Pollard, cidA))).toBe(true);
        expect(isLeavesEqual(createLeaf(LeafTypes.Pollard, cidA), createLeaf(LeafTypes.Pollard, cidB))).toBe(false);
    });

    it("treats different leaf types as different", () => {
        expect(isLeavesEqual(createLeaf(LeafTypes.Pollard, cidA), createLeaf(LeafTypes.Identity, cidA))).toBe(false);
        expect(isLeavesEqual(createLeaf(), createLeaf(LeafTypes.Pollard, cidA))).toBe(false);
    });
});
