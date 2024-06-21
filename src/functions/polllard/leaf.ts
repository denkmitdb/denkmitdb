import { LeafType, LeafTypes } from "../../types";

/**
 * Creates a leaf node for the denkmitdb database.
 *
 * @param type - The type of the leaf node.
 * @param data - The data associated with the leaf node.
 * @param sortFields - An optional array of sort fields for SortedEntry type.
 * @param key - An optional key for the leaf node.
 * @returns The created leaf node.
 * @throws Error if sortFields are required for SortedEntry type but not provided.
 */
export function createLeaf(type?: LeafTypes, data?: Uint8Array, sortFields?: number[], key?: string): LeafType {
    const leaf: LeafType = [type || LeafTypes.Empty, data || new Uint8Array(0)];
    if (type === LeafTypes.SortedEntry && !sortFields) throw new Error("Sort fields are required for SortedEntry");
    if (sortFields) leaf.push(sortFields);
    if (key) leaf.push(key);

    return leaf;
}

/**
 * Checks if two leaves are equal.
 * @param leaf1 - The first leaf to compare.
 * @param leaf2 - The second leaf to compare.
 * @returns Returns `true` if the leaves are equal, `false` otherwise.
 */
export function isLeavesEqual(leaf1: LeafType, leaf2: LeafType): boolean {
    const [type1, data1] = leaf1;
    const [type2, data2] = leaf2;

    if (type1 !== type2) return false;
    if (type1 == LeafTypes.Empty) return true;
    if (data1.length !== data2.length) return false;

    return data1.every((byte, index) => byte === data2[index]);
}
