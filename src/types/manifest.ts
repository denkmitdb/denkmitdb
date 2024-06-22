import { CID } from "multiformats/cid";
import { HeliaStorage } from "src/functions";
import { DenkmitMetadata } from "./utils";

export const MANIFEST_VERSION = 1;
export type ManifestVersionType = typeof MANIFEST_VERSION;

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

export declare function createManifest(manifest: ManifestData, heliaStorage: HeliaStorage): Promise<ManifestInterface>;
export declare function fetchManifest(cid: CID, heliaStorage: HeliaStorage): Promise<ManifestInterface>;
