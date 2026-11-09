/**
 * DenkMitDB: a signed, peer-to-peer replicated key-value database on Helia.
 *
 * This is the whole public API. Everything else in the package is internal and
 * may change in any release.
 *
 * @packageDocumentation
 */
import type { CID } from "multiformats/cid";
import { createDatabase as createDatabaseInstance, openDatabase as openDatabaseInstance } from "./database.js";
import type { CreateDatabaseOptions, Database, DatabaseOptions } from "./types.js";

/**
 * Creates a database: signs its policies and manifest with `options.identity`
 * and starts syncing on the node. The returned database's `address` is what
 * other peers open.
 *
 * @param name - The database name (recorded in the manifest; not unique).
 * @param options - Node, identity, access preset or custom policies, order.
 * @typeParam T - The type of values stored in the database.
 * @throws Error - If the options are invalid (unknown preset, bad order, malformed policy).
 */
export function createDatabase<T>(name: string, options: CreateDatabaseOptions<T>): Promise<Database<T>> {
    return createDatabaseInstance<T>(name, options);
}

/**
 * Opens a database by address: fetches and verifies its manifest and policies,
 * restores the locally persisted head, and starts syncing. Access and validation
 * always come from the signed manifest, never from local options.
 *
 * @param address - The database address (manifest CID), as a CID or string.
 * @param options - Node and identity.
 * @typeParam T - The type of values stored in the database.
 */
export function openDatabase<T>(address: CID | string, options: DatabaseOptions<T>): Promise<Database<T>> {
    return openDatabaseInstance<T>(address, options);
}

export { createIdentity, fetchIdentity, hasIdentity, openIdentity } from "./identity.js";
export { decryptValue, encryptedRecipients, encryptValueFor, isEncryptedValue } from "./encryption.js";

export type { EncryptedValue, EncryptionContext } from "./encryption.js";
export type { IdentityAlgorithm } from "./protocol/identity.js";
export type { PolicyDefinition } from "./protocol/policy.js";
export type {
    AccessPreset,
    CreateDatabaseOptions,
    Database,
    DatabaseOptions,
    HeliaNode,
    Identity,
    Manifest,
    NodeLibp2p,
    Policy,
    Provenance,
    SigningIdentity,
    WriteOptions,
} from "./types.js";
