import * as codec from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { describe, expect, it } from "vitest";
import { createLeaf, isLeavesEqual } from "../src/internal";
import { LeafKind } from "../src/internal";

async function cidOf(value: unknown): Promise<CID> {
    const bytes = codec.encode(value);
    return CID.createV1(codec.code, await sha256.digest(bytes));
}

const cidA = await cidOf("a");
const cidB = await cidOf("b");

describe("createLeaf", () => {
    it("creates an empty leaf by default", () => {
        expect(createLeaf()).toEqual({ type: LeafKind.Empty });
        expect(createLeaf(LeafKind.Empty)).toEqual({ type: LeafKind.Empty });
    });

    it("creates a hash leaf", () => {
        const hash = new Uint8Array([1, 2, 3]);
        expect(createLeaf(LeafKind.Hash, hash)).toEqual({ type: LeafKind.Hash, hash });
    });

    it("creates a pollard leaf holding a CID link", () => {
        expect(createLeaf(LeafKind.Pollard, cidA)).toEqual({ type: LeafKind.Pollard, link: cidA });
    });

    it("creates a sorted-entry leaf with sort key, key and creator", () => {
        const leaf = createLeaf(LeafKind.SortedEntry, cidA, cidB, [42], "answer");
        expect(leaf).toEqual({ type: LeafKind.SortedEntry, link: cidA, creator: cidB, sort: [42], key: "answer" });
    });
});

describe("isLeavesEqual", () => {
    it("treats two empty leaves as equal", () => {
        expect(isLeavesEqual(createLeaf(), createLeaf())).toBe(true);
    });

    it("compares hash leaves by content", () => {
        const a = createLeaf(LeafKind.Hash, new Uint8Array([1, 2, 3]));
        const b = createLeaf(LeafKind.Hash, new Uint8Array([1, 2, 3]));
        const c = createLeaf(LeafKind.Hash, new Uint8Array([9, 9, 9]));
        expect(isLeavesEqual(a, b)).toBe(true);
        expect(isLeavesEqual(a, c)).toBe(false);
    });

    it("compares linked leaves by CID bytes", () => {
        expect(isLeavesEqual(createLeaf(LeafKind.Pollard, cidA), createLeaf(LeafKind.Pollard, cidA))).toBe(true);
        expect(isLeavesEqual(createLeaf(LeafKind.Pollard, cidA), createLeaf(LeafKind.Pollard, cidB))).toBe(false);
    });

    it("treats different leaf types as different", () => {
        expect(isLeavesEqual(createLeaf(LeafKind.Pollard, cidA), createLeaf(LeafKind.Identity, cidA))).toBe(false);
        expect(isLeavesEqual(createLeaf(), createLeaf(LeafKind.Pollard, cidA))).toBe(false);
    });

    // KNOWN_ISSUES.md #12 — SortedEntry equality compares only the link CID and
    // ignores sort/key/creator, so tree comparison can hide differing (or forged)
    // index metadata. Two SortedEntry leaves with the same link but a different
    // key must be considered different.
    it("distinguishes SortedEntry leaves that differ only in metadata", () => {
        const a = createLeaf(LeafKind.SortedEntry, cidA, cidB, [1], "key-a");
        const b = createLeaf(LeafKind.SortedEntry, cidA, cidB, [1], "key-b");
        expect(isLeavesEqual(a, b)).toBe(false);
    });
});
