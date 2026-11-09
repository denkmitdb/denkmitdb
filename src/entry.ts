import { logger } from "@libp2p/logger";
import { CID } from "multiformats/cid";
import {
    assertEntryPayload,
    ENTRY_VERSION,
    EntryPayload,
    LEGACY_ENTRY_VERSION,
    PutPayload,
    TombstonePayload,
} from "./protocol/entry.js";
import type { Signed, SignedMeta } from "./protocol/signed.js";
import type { HeliaController } from "./storage/helia.js";

const log = logger("denkmit:entry");

/** A verified signed entry: its payload plus where it is stored and who signed it. */
export type Entry<T> = EntryPayload<T> & SignedMeta;

function toEntry<T>(signed: Signed<EntryPayload<T>>): Entry<T> {
    return { ...signed.data, cid: signed.cid, creator: signed.creator };
}

/**
 * Signs and stores a put entry.
 *
 * @param key - The key of the entry.
 * @param value - The value of the entry.
 * @param controller - Signs with its identity.
 * @param manifest - The address of the database the entry is written to. Bound
 *   into the signed payload so the entry cannot be replayed into another database
 *   (KNOWN_ISSUES.md #24). Omitting it produces a legacy v1 entry, which only
 *   legacy (v1-manifest) databases accept.
 */
export async function createEntry<T>(
    key: string,
    value: T,
    controller: HeliaController,
    manifest?: CID,
): Promise<Entry<T>> {
    log("Creating entry with key, value:", { key, value });
    const data: PutPayload<T> = manifest
        ? { version: ENTRY_VERSION, manifest, timestamp: Date.now(), key, value }
        : { version: LEGACY_ENTRY_VERSION, timestamp: Date.now(), key, value };
    return toEntry(await controller.addSigned(data));
}

/**
 * Signs and stores a tombstone for `key`: a delete record that takes part in the
 * same last-write-wins order as puts (specs/ordering.md).
 *
 * @param key - The key to delete.
 * @param controller - Signs with its identity.
 * @param manifest - The database address to bind the tombstone to (see createEntry).
 */
export async function createTombstone(key: string, controller: HeliaController, manifest?: CID): Promise<Entry<never>> {
    log("Creating tombstone for key:", { key });
    const data: TombstonePayload = manifest
        ? { version: ENTRY_VERSION, manifest, timestamp: Date.now(), key, deleted: true }
        : { version: LEGACY_ENTRY_VERSION, timestamp: Date.now(), key, deleted: true };
    return toEntry<never>(await controller.addSigned(data));
}

/**
 * Fetches and verifies an entry.
 *
 * @param cid - The CID of the signed entry.
 * @param controller - Fetches and verifies.
 * @throws DenkmitError - `UNAVAILABLE`, `INVALID_SIGNATURE`, `MALFORMED` or
 *   `UNSUPPORTED_VERSION`.
 */
export async function fetchEntry<T>(cid: CID, controller: HeliaController): Promise<Entry<T>> {
    log("Fetching entry with CID: ", cid);
    const result = await controller.getSigned<EntryPayload<T>>(cid);
    assertEntryPayload(result.data);
    return toEntry(result);
}
