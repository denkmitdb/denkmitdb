import { CID } from "multiformats/cid";
import { DenkmitMetadata } from "./utils.js";

/**
 * Current manifest format. A v2 database accepts only v2 entries bound to its own
 * address (KNOWN_ISSUES.md #24).
 */
export const MANIFEST_VERSION = 2;

/** The 3.0.0 manifest format: its database also accepts legacy unbound entries. */
export const LEGACY_MANIFEST_VERSION = 1;

export type ManifestVersionType = typeof MANIFEST_VERSION | typeof LEGACY_MANIFEST_VERSION;

/**
 * Represents the type of a Database manifest.
 */
export type ManifestData = {
    /**
     * The version of the manifest.
     */
    readonly version: ManifestVersionType;

    readonly timestamp: number;

    /**
     * The name of the database.
     */
    readonly name: string;

    /**
     * The type of the database.
     */
    readonly type: string;

    /**
     * The Pollard order in the database.
     */
    readonly order: number;

    /**
     * The consensus controller CID of the database.
     */
    readonly consensus: CID;

    /**
     * The access controller CID of the database.
     */
    readonly access: CID;

    /**
     * Additional metadata for the database.
     */
    readonly meta?: Record<string, unknown>;
};

export type ManifestType = ManifestData & DenkmitMetadata;

export interface ManifestInterface extends ManifestType {
    toJSON(): ManifestData;
}

