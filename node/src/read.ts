/**
 * Reading a value together with the provenance of the entry it came from
 * (KNOWN_ISSUES.md #35).
 *
 * `get` and `provenance` each read the index once. Called one after the other, a
 * replacement indexed between the two awaits — a local write or a merged remote
 * entry — would pair the old value with the new writer and write time. The winning
 * record of a key only moves forward (last-write-wins never returns to an earlier
 * entry), so when the provenance read before and after the value names the same
 * entry, the value is exactly that entry's value.
 */
import { DenkmitError } from "@denkmitdb/denkmitdb";
import type { Database, Provenance } from "@denkmitdb/denkmitdb";

/** A value and the provenance of the signed entry it belongs to. */
export type AttributedValue<T> = { value: T; record: Provenance };

/** The two reads `readAttributed` needs; a full `Database` satisfies it. */
export type AttributedSource<T> = Pick<Database<T>, "get" | "provenance">;

/**
 * Reads `key`'s current value and the provenance of the entry it came from.
 *
 * @param db - The database (or anything with its `get` and `provenance`).
 * @param key - The key to read.
 * @param attempts - How often to retry while the record keeps changing.
 * @returns The value and its provenance, or undefined if the key is absent,
 *   deleted, or its value cannot be fetched.
 * @throws DenkmitError - `UNAVAILABLE` if the record changed on every attempt.
 */
export async function readAttributed<T>(
    db: AttributedSource<T>,
    key: string,
    attempts = 5,
): Promise<AttributedValue<T> | undefined> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const before = await db.provenance(key);
        if (!before || before.deleted) return undefined;
        const value = await db.get(key);
        const after = await db.provenance(key);
        if (!after || after.deleted) return undefined;
        if (after.entryCid.equals(before.entryCid)) return value === undefined ? undefined : { value, record: after };
    }
    throw new DenkmitError("UNAVAILABLE", `The record for key "${key}" kept changing while it was read; retry`);
}
