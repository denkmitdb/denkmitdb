import * as jose from "jose";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import type { Identity, SigningIdentity } from "./types.js";
import { HeliaStorage } from "./storage/helia.js";

/** Key management algorithm for every recipient: ECDH-ES key agreement + AES key wrap. */
export const ENCRYPTION_KEY_ALG = "ECDH-ES+A256KW";
/** Content encryption: one AES-256-GCM body shared by all recipients. */
export const ENCRYPTION_CONTENT_ENC = "A256GCM";

/**
 * A value encrypted to one or more recipient identities. It is an ordinary,
 * dag-cbor-serializable database value: it replicates signed and
 * provenance-attributed like any record, while peers relay ciphertext they cannot
 * read. The JWE uses the General JSON serialization — one shared ciphertext and
 * one wrapped key per recipient, whose `kid` is the recipient's identity CID.
 *
 * What stays visible to every replica: the key, the writer (provenance), the
 * write time, the recipients' identity CIDs and the ciphertext size. The
 * recipient list is the writer's claim: it shows whom the writer says it sealed
 * the value to, not proof that every listed identity can decrypt it.
 */
export type EncryptedValue = {
    readonly denkmitEncrypted: 1;
    readonly jwe: jose.GeneralJWE;
};

/**
 * Where an encrypted value is published: database address, record key and the
 * writer's identity CID. Bound into the JWE as additional authenticated data, so a
 * recipient can refuse an envelope that somebody re-posted elsewhere — without the
 * binding, anyone allowed to write could copy a sealed value under their own key,
 * and a recipient would read it attributed to the wrong writer or context.
 */
export type EncryptionContext = {
    readonly database: string;
    readonly key: string;
    readonly writer: string;
};

const isString = (v: unknown): v is string => typeof v === "string";

/** Whether a stored value is a well-formed encrypted envelope produced by {@link encryptValueFor}. */
export function isEncryptedValue(value: unknown): value is EncryptedValue {
    if (typeof value !== "object" || value === null) return false;
    const v = value as { denkmitEncrypted?: unknown; jwe?: unknown };
    if (v.denkmitEncrypted !== 1 || typeof v.jwe !== "object" || v.jwe === null) return false;
    const jwe = v.jwe as Record<string, unknown>;
    if (![jwe.ciphertext, jwe.iv, jwe.tag, jwe.protected].every(isString)) return false;
    if (jwe.aad !== undefined && !isString(jwe.aad)) return false;
    if (!Array.isArray(jwe.recipients) || jwe.recipients.length === 0) return false;
    return jwe.recipients.every((r: unknown) => {
        if (typeof r !== "object" || r === null) return false;
        const { header, encrypted_key } = r as { header?: unknown; encrypted_key?: unknown };
        if (typeof header !== "object" || header === null) return false;
        const { kid, alg } = header as { kid?: unknown; alg?: unknown };
        return isString(kid) && isString(alg) && isString(encrypted_key);
    });
}

/** The identity CIDs a value claims to be encrypted to (from the per-recipient `kid`); [] if malformed. */
export function encryptedValueRecipients(value: EncryptedValue): string[] {
    if (!isEncryptedValue(value)) return [];
    return value.jwe.recipients.map((r) => r.header?.kid).filter(isString);
}

/** Canonical encoding of a context (dag-cbor sorts map keys), as JWE AAD. */
function contextAad(context: EncryptionContext): Uint8Array {
    return HeliaStorage.encode({ database: context.database, key: context.key, writer: context.writer });
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
 * @param context - Optional publication context to bind (see {@link EncryptionContext}).
 * @returns The envelope to store as the entry's value.
 * @throws Error - With no recipients, or a recipient whose key cannot do ECDH (not EC).
 */
export async function encryptValueFor(
    recipients: Identity | Identity[],
    value: unknown,
    context?: EncryptionContext,
): Promise<EncryptedValue> {
    const list = Array.isArray(recipients) ? recipients : [recipients];
    const unique = [...new Map(list.map((r) => [r.cid.toString(), r])).values()];
    if (unique.length === 0) throw new Error("encryptValueFor needs at least one recipient");

    const encrypt = new jose.GeneralEncrypt(HeliaStorage.encode(value)).setProtectedHeader({
        enc: ENCRYPTION_CONTENT_ENC,
    });
    if (context) encrypt.setAdditionalAuthenticatedData(contextAad(context));
    for (const recipient of unique) {
        const jwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(recipient.publicKey, "base64"));
        if (jwk.kty !== "EC") {
            throw new Error(`identity ${recipient.cid.toString()} has a ${jwk.kty} key; encryption needs an EC key`);
        }
        const key = (await jose.importJWK({ ...jwk, alg: ENCRYPTION_KEY_ALG }, ENCRYPTION_KEY_ALG)) as CryptoKey;
        encrypt.addRecipient(key).setUnprotectedHeader({ alg: ENCRYPTION_KEY_ALG, kid: recipient.cid.toString() });
    }
    return { denkmitEncrypted: 1, jwe: await encrypt.encrypt() };
}

/**
 * Decrypts a value produced by {@link encryptValueFor} with this identity's
 * private key. Returns `undefined` when this identity is not a recipient, its
 * private key is unavailable, the envelope is malformed or tampered with, or —
 * when `expected` is given — the envelope is not bound to exactly that context
 * (re-posted elsewhere, or sealed without a context). It never throws, so callers
 * can probe records without try/catch.
 *
 * @param identity - A recipient identity with its private key.
 * @param value - The stored envelope.
 * @param expected - The context the value is read in; strongly recommended.
 * @returns The decoded value, or undefined.
 */
export async function decryptValue<T>(
    identity: SigningIdentity,
    value: EncryptedValue,
    expected?: EncryptionContext,
): Promise<T | undefined> {
    try {
        if (!isEncryptedValue(value)) return undefined;
        if (expected && value.jwe.aad !== jose.base64url.encode(contextAad(expected))) return undefined;
        const kid = identity.cid.toString();
        const recipient = value.jwe.recipients.find((r) => r.header?.kid === kid);
        if (!recipient) return undefined;
        // The recipient's slice of a General JWE is a Flattened JWE.
        const { ciphertext, iv, tag, aad, unprotected } = value.jwe;
        const flattened: jose.FlattenedJWE = {
            ciphertext,
            iv,
            tag,
            protected: value.jwe.protected,
            ...(aad !== undefined ? { aad } : {}),
            ...(unprotected !== undefined ? { unprotected } : {}),
            header: recipient.header,
            encrypted_key: recipient.encrypted_key,
        };
        const plaintext = await identity.decrypt(flattened);
        if (!(plaintext instanceof Uint8Array)) return undefined;
        return HeliaStorage.decode<T>(plaintext);
    } catch {
        return undefined;
    }
}
