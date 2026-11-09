import { CID } from "multiformats/cid";

/**
 * Current manifest format. A v2 database accepts only v2 entries bound to its own
 * address (KNOWN_ISSUES.md #24).
 */
export const MANIFEST_VERSION = 2;

/** The 3.0.0 manifest format: its database also accepts legacy unbound entries. */
export const LEGACY_MANIFEST_VERSION = 1;

/** The only database type so far. */
export const KEY_VALUE_DATABASE_TYPE = "denkmit-database-key-value";

/**
 * The signed manifest payload, exactly as encoded on the wire. Its CID is the
 * database address.
 */
export type ManifestPayload = {
    readonly version: typeof MANIFEST_VERSION | typeof LEGACY_MANIFEST_VERSION;
    readonly timestamp: number;
    readonly name: string;
    readonly type: string;
    /** log2 of the leaves per Merkle subtree (API: `subtreeLeaves`). */
    readonly order: number;
    /** CID of the validity rule (API: `consensus.validity`). */
    readonly consensus: CID;
    /** CID of the access rule (API: `consensus.access`). */
    readonly access: CID;
    readonly meta?: Record<string, unknown>;
};

/**
 * Checks a fetched manifest the way database creation checks its inputs: a
 * signature proves who wrote a manifest, not that it is usable (KNOWN_ISSUES.md #24).
 *
 * @param data - The decoded, signature-verified manifest payload.
 * @throws TypeError - If the manifest is not a well-formed v1 or v2 manifest.
 */
export function assertManifestPayload(data: unknown): asserts data is ManifestPayload {
    if (typeof data !== "object" || data === null) throw new TypeError("Manifest is not an object");
    const manifest = data as Record<string, unknown>;
    if (manifest.version !== MANIFEST_VERSION && manifest.version !== LEGACY_MANIFEST_VERSION) {
        throw new TypeError(`Unsupported manifest version ${String(manifest.version)}`);
    }
    const order = manifest.order;
    if (typeof order !== "number" || !Number.isInteger(order) || order < 1 || order > 8) {
        throw new TypeError("Manifest order must be an integer in [1, 8]");
    }
    if (CID.asCID(manifest.consensus) === null || CID.asCID(manifest.access) === null) {
        throw new TypeError("Manifest policies must be CIDs");
    }
    if (typeof manifest.name !== "string" || typeof manifest.type !== "string") {
        throw new TypeError("Manifest name and type must be strings");
    }
}
