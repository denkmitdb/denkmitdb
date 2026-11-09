import { CID } from "multiformats/cid";

/**
 * Current entry format. v2 entries carry the address (manifest CID) of the
 * database they were written to, inside the signed payload, so an entry cannot be
 * replayed into another database that shares a writer (KNOWN_ISSUES.md #24).
 */
export const ENTRY_VERSION = 2;

/**
 * The 3.0.0 entry format: no database binding. Accepted only by legacy (v1
 * manifest) databases, so data written by 3.0.0 stays readable.
 */
export const LEGACY_ENTRY_VERSION = 1;

/**
 * The database binding: required in v2, absent in v1. The field is named
 * `manifest` on the wire; it holds the database address (the manifest's CID).
 */
type Binding =
    | { readonly version: typeof ENTRY_VERSION; readonly manifest: CID }
    | { readonly version: typeof LEGACY_ENTRY_VERSION; readonly manifest?: never };

/** A put: the key holds `value`. */
export type PutPayload<T> = Binding & {
    readonly timestamp: number;
    readonly key: string;
    readonly value: T;
    readonly deleted?: never;
};

/**
 * A tombstone: the key is deleted. Deletes take part in the same last-write-wins
 * order as puts; a winning tombstone hides the key, a newer put resurrects it, and
 * the tombstone record stays in the Merkle tree (specs/ordering.md).
 */
export type TombstonePayload = Binding & {
    readonly timestamp: number;
    readonly key: string;
    readonly deleted: true;
    readonly value?: never;
};

/**
 * The signed payload of an entry, exactly as encoded on the wire. Field names and
 * the absence of undefined fields matter: dag-cbor encodes this object as is.
 */
export type EntryPayload<T> = PutPayload<T> | TombstonePayload;

/**
 * Checks the shape of a decoded entry payload. A valid signature only proves who
 * wrote the bytes, not that they are a well-formed entry, so every field is
 * checked before the entry is trusted for indexing (KNOWN_ISSUES.md #24).
 *
 * @param data - The decoded, signature-verified payload.
 * @throws TypeError - If the payload is not a well-formed v1 or v2 entry.
 */
export function assertEntryPayload(data: unknown): asserts data is EntryPayload<unknown> {
    if (typeof data !== "object" || data === null) throw new TypeError("Entry is not an object");
    const entry = data as Record<string, unknown>;
    if (entry.version !== ENTRY_VERSION && entry.version !== LEGACY_ENTRY_VERSION) {
        throw new TypeError(`Unsupported entry version ${String(entry.version)}`);
    }
    if (entry.version === ENTRY_VERSION && CID.asCID(entry.manifest) === null) {
        throw new TypeError("Entry is not bound to a database");
    }
    if (entry.version === LEGACY_ENTRY_VERSION && entry.manifest !== undefined) {
        throw new TypeError("Legacy entry carries a database binding");
    }
    if (typeof entry.timestamp !== "number" || !Number.isSafeInteger(entry.timestamp) || entry.timestamp < 0) {
        throw new TypeError("Entry timestamp is not a non-negative integer");
    }
    if (typeof entry.key !== "string") throw new TypeError("Entry key is not a string");
    const isTombstone = "deleted" in entry;
    const isPut = "value" in entry;
    if (isTombstone === isPut) throw new TypeError("Entry must be exactly one of put or tombstone");
    if (isTombstone && entry.deleted !== true) throw new TypeError("Tombstone flag must be true");
}
