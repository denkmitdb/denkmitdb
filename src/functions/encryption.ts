import * as jose from "jose";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { IdentityInterface } from "../types/index.js";
import { HeliaStorage } from "./utils/helia.js";

/** Key management algorithm for every recipient: ECDH-ES key agreement + AES key wrap. */
const KEY_ALG = "ECDH-ES+A256KW";
/** Content encryption: one AES-256-GCM body shared by all recipients. */
const CONTENT_ENC = "A256GCM";

/**
 * A value encrypted to one or more recipient identities. It is an ordinary,
 * dag-cbor-serializable database value: it replicates signed and
 * provenance-attributed like any record, while peers relay ciphertext they cannot
 * read. The JWE uses the General JSON serialization — one shared ciphertext and
 * one wrapped key per recipient, whose `kid` is the recipient's identity CID.
 *
 * What stays visible to every replica: the key, the writer (provenance), the
 * write time, the recipients' identity CIDs and the ciphertext size.
 */
export type EncryptedValue = {
    readonly denkmitEncrypted: 1;
    readonly jwe: jose.GeneralJWE;
};

/** Whether a stored value is an encrypted envelope produced by {@link encryptValueFor}. */
export function isEncryptedValue(value: unknown): value is EncryptedValue {
    if (typeof value !== "object" || value === null) return false;
    const v = value as { denkmitEncrypted?: unknown; jwe?: { recipients?: unknown; ciphertext?: unknown } };
    return (
        v.denkmitEncrypted === 1 &&
        typeof v.jwe === "object" &&
        v.jwe !== null &&
        typeof v.jwe.ciphertext === "string" &&
        Array.isArray(v.jwe.recipients)
    );
}

/** The identity CIDs a value is encrypted to (from the per-recipient `kid`). */
export function encryptedRecipients(value: EncryptedValue): string[] {
    return value.jwe.recipients
        .map((r) => r.header?.kid)
        .filter((kid): kid is string => typeof kid === "string");
}

/**
 * Encrypts a value to one or more recipient identities: the value is
 * dag-cbor-encoded and sealed once with AES-256-GCM, and the content key is
 * wrapped for each recipient with ECDH-ES on its public key. Recipients may be
 * fetched identities (public key only) — the sender never needs their private
 * keys. Include your own identity to be able to read the value back.
 *
 * @param recipients - One identity or a list (duplicates are folded).
 * @param value - Any dag-cbor-serializable value.
 * @returns The envelope to store as the entry's value.
 * @throws Error - With no recipients, or a recipient whose key cannot do ECDH (not EC).
 */
export async function encryptValueFor(
    recipients: IdentityInterface | IdentityInterface[],
    value: unknown,
): Promise<EncryptedValue> {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    const unique = [...new Map(list.map((r) => [r.cid.toString(), r])).values()];
    if (unique.length === 0) throw new Error("encryptValueFor needs at least one recipient");

    const encrypt = new jose.GeneralEncrypt(HeliaStorage.encode(value)).setProtectedHeader({ enc: CONTENT_ENC });
    for (const recipient of unique) {
        const jwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(recipient.publicKey, "base64"));
        if (jwk.kty !== "EC") {
            throw new Error(`identity ${recipient.cid.toString()} has a ${jwk.kty} key; encryption needs an EC key`);
        }
        const key = (await jose.importJWK({ ...jwk, alg: KEY_ALG }, KEY_ALG)) as CryptoKey;
        encrypt.addRecipient(key).setUnprotectedHeader({ alg: KEY_ALG, kid: recipient.cid.toString() });
    }
    return { denkmitEncrypted: 1, jwe: await encrypt.encrypt() };
}

/**
 * Decrypts a value produced by {@link encryptValueFor} with this identity's
 * private key. Returns `undefined` when this identity is not a recipient, its
 * private key is unavailable, or the envelope is invalid or tampered with — it
 * never throws, so callers can probe records without try/catch.
 *
 * @param identity - A recipient identity with its private key.
 * @param value - The stored envelope.
 * @returns The decoded value, or undefined.
 */
export async function decryptValue<T>(identity: IdentityInterface, value: EncryptedValue): Promise<T | undefined> {
    if (!isEncryptedValue(value)) return undefined;
    const kid = identity.cid.toString();
    const recipient = value.jwe.recipients.find((r) => r.header?.kid === kid);
    if (!recipient) return undefined;
    try {
        // The recipient's slice of a General JWE is a Flattened JWE.
        const { recipients: _all, ...shared } = value.jwe;
        void _all;
        const flattened: jose.FlattenedJWE = {
            ...shared,
            ...(recipient.header ? { header: recipient.header } : {}),
            ...(recipient.encrypted_key ? { encrypted_key: recipient.encrypted_key } : {}),
        };
        const plaintext = await identity.decrypt(flattened);
        if (!(plaintext instanceof Uint8Array)) return undefined;
        return HeliaStorage.decode<T>(plaintext);
    } catch {
        return undefined;
    }
}
