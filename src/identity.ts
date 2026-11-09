import { Key } from "interface-datastore";
import * as jose from "jose";
import { CID } from "multiformats/cid";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { IDENTITY_VERSION, IdentityAlgorithm, IdentityKind, IdentityPayload } from "./protocol/identity.js";
import { HeliaStorage } from "./storage/helia.js";
import type { HeliaNode, Identity, SigningIdentity } from "./types.js";

/** Key material of an identity; the private key is present only when opened with its passphrase. */
export type KeyPair = Partial<jose.GenerateKeyPairResult>;

const keyPrefix = "/Denkmit/";

/**
 * An identity backed by key material. Implements {@link SigningIdentity}; signing
 * and decryption throw/return undefined when no private key is loaded.
 */
class KeyIdentity implements SigningIdentity {
    readonly cid: CID;
    readonly name: string;
    readonly alg: IdentityAlgorithm;
    readonly publicKey: string;

    private keys: KeyPair;

    constructor(cid: CID, payload: IdentityPayload, keys?: KeyPair) {
        this.cid = cid;
        this.name = payload.name;
        this.alg = payload.alg;
        this.publicKey = payload.publicKey;
        this.keys = keys || {};
    }

    /**
     * Retrieves the public key in a format compatible with the jose library.
     * @returns A promise that resolves to the public key in CryptoKey format.
     * @internal
     */
    private async getPublicKeyLike(): Promise<CryptoKey> {
        if (this.keys.publicKey) return this.keys.publicKey;

        const publicJwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(this.publicKey, "base64"));
        // jose 6 requires the algorithm when the JWK has no `alg`; pass it explicitly.
        this.keys.publicKey = (await jose.importJWK(publicJwk, this.alg)) as CryptoKey;

        return this.keys.publicKey;
    }

    /**
     * Verifies the given JWS (JSON Web Signature) using the public key associated with the identity.
     * @param jws - The JWS to verify.
     * @returns A promise that resolves to the payload of the JWS if verification is successful, or undefined otherwise.
     */
    async verify(jws: jose.FlattenedJWSInput): Promise<Uint8Array | undefined> {
        const { kid } = jose.decodeProtectedHeader(jws);
        if (!kid) throw new Error("Key ID not found in JWS header");
        if (kid !== this.cid.toString()) throw new Error("Key ID does not match identity ID");

        const pk = await this.getPublicKeyLike();

        try {
            const result = await jose.flattenedVerify(jws, pk);

            return result.payload;
        } catch {
            return undefined;
        }
    }

    /**
     * Signs the given data using the private key associated with the identity.
     * @param data - The data to sign.
     * @returns A promise that resolves to the JWS (JSON Web Signature) of the signed data.
     */
    async sign(data: Uint8Array): Promise<jose.FlattenedJWS> {
        if (!this.keys.privateKey) throw new Error("Private key is not available");

        return await createJWS(data, this.keys, { alg: this.alg, kid: this.cid.toString(), includeJwk: false });
    }

    /**
     * Encrypts the given data using the public key associated with the identity.
     * @param data - The data to encrypt.
     * @returns A promise that resolves to the JWE (JSON Web Encryption) of the encrypted data.
     */
    async encrypt(data: Uint8Array): Promise<jose.FlattenedJWE> {
        // The identity's EC key is imported for signing (ES384); ECDH-ES key
        // agreement needs a key with `deriveBits` usage, so re-import the same
        // public key material under the key-management algorithm (jose 6 pins
        // CryptoKey usages to the import algorithm).
        const publicJwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(this.publicKey, "base64"));
        const pk = (await jose.importJWK(publicJwk, "ECDH-ES+A256KW")) as CryptoKey;

        return await new jose.FlattenedEncrypt(data)
            .setProtectedHeader({ alg: "ECDH-ES+A256KW", kid: this.cid.toString(), enc: "A256GCM" })
            .encrypt(pk);
    }

    /**
     * Decrypts the given JWE (JSON Web Encryption) using the private key associated with the identity.
     * @param jwe - The JWE to decrypt.
     * @returns The plaintext, or undefined if decryption fails.
     */
    async decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | undefined> {
        // The recipient's kid lives in the protected header for single-recipient
        // JWEs, and in the per-recipient (unprotected) header for one recipient's
        // slice of a multi-recipient JWE (see encryptValueFor). It only selects the
        // key: authenticity comes from AES-GCM over the shared protected header.
        const kid = jose.decodeProtectedHeader(jwe).kid ?? jwe.header?.kid;
        if (!kid) throw new Error("Key ID not found in JWE header");
        if (kid !== this.cid.toString()) throw new Error("Key ID does not match identity ID");

        if (!this.keys.privateKey) throw new Error("Private key is not available");

        try {
            // Re-import the private key under the ECDH-ES algorithm so it carries
            // the `deriveBits` usage that key agreement requires (see encrypt()).
            const privateJwk = await jose.exportJWK(this.keys.privateKey);
            privateJwk.alg = "ECDH-ES+A256KW";
            const decryptionKey = (await jose.importJWK(privateJwk, "ECDH-ES+A256KW")) as CryptoKey;
            // Pin the suite this library produces: never let an attacker-chosen
            // header select a different (e.g. weaker) algorithm.
            const result = await jose.flattenedDecrypt(jwe, decryptionKey, {
                keyManagementAlgorithms: ["ECDH-ES+A256KW"],
                contentEncryptionAlgorithms: ["A256GCM"],
            });
            return result.plaintext;
        } catch {
            return undefined;
        }
    }
}

async function exportPrivateKey(keys: KeyPair, passphrase: string, alg: string): Promise<jose.FlattenedJWE> {
    if (!keys.privateKey) throw new Error("Private key is not available");

    const encryptionConfig = { alg: "PBES2-HS256+A128KW", enc: "A128GCM" };

    const jwk = await jose.exportJWK(keys.privateKey);
    // Stamp the signing algorithm so importJWK can infer it on the way back in
    // (jose 6 no longer guesses from the key type).
    jwk.alg = alg;
    const encryptedPrivateKey = await new jose.FlattenedEncrypt(HeliaStorage.encode(jwk))
        .setProtectedHeader(encryptionConfig)
        .encrypt(uint8ArrayFromString(passphrase));

    return encryptedPrivateKey;
}

async function importPrivateKey(encryptedPrivateKey: jose.FlattenedJWE, passphrase: string): Promise<KeyPair> {
    const encryptionConfig = {
        keyManagementAlgorithms: ["PBES2-HS256+A128KW"],
        contentEncryptionAlgorithms: ["A128GCM"],
    };

    const decrypted = await jose.flattenedDecrypt(
        encryptedPrivateKey,
        uint8ArrayFromString(passphrase),
        encryptionConfig,
    );
    const jwk = HeliaStorage.decode<jose.JWK>(decrypted.plaintext);
    // Extractable so decrypt() can re-import it under the ECDH-ES algorithm; alg is
    // read from the stamped JWK (jose 6 no longer infers it from the key type).
    const privateKey = (await jose.importJWK(jwk, jwk.alg, { extractable: true })) as CryptoKey;

    return { privateKey };
}

async function encodePublicKey(publicKey: CryptoKey): Promise<string> {
    const publicJwk = await jose.exportJWK(publicKey);
    return uint8ArrayToString(HeliaStorage.encode(publicJwk), "base64");
}

type createJWSOptions = {
    alg: string;
    kid?: string;
    includeJwk?: boolean;
};

async function createJWS(payload: Uint8Array, keys: KeyPair, options?: createJWSOptions): Promise<jose.FlattenedJWS> {
    options = options || { alg: "ES384" };
    const { alg, kid } = options;
    const includeJwk = options.includeJwk ?? false;

    const headers: jose.JWSHeaderParameters = { alg, kid };
    if (!keys.privateKey) throw new Error("Private key is not available");

    if (keys.publicKey && includeJwk) headers.jwk = await jose.exportJWK(keys.publicKey);

    return await new jose.FlattenedSign(payload).setProtectedHeader(headers).sign(keys.privateKey);
}

/**
 * Loads and verifies an identity block; with `keys`, the result can sign.
 * @internal
 */
export async function loadIdentity(cid: CID, heliaStorage: HeliaStorage, keys?: KeyPair): Promise<SigningIdentity> {
    const identityJWS = await heliaStorage.get<jose.FlattenedJWS>(cid);
    if (!identityJWS) throw new Error("Identity not found");

    const verified = await jose.flattenedVerify(identityJWS, jose.EmbeddedJWK);
    const data: IdentityPayload = HeliaStorage.decode(verified.payload);

    // The block is self-signed with the JWK embedded in its header, but every later
    // verification uses the public key stated in the payload. Require them to be the
    // same key (and algorithm), so an identity block is self-certifying for the key
    // it advertises (KNOWN_ISSUES.md #29).
    const header = verified.protectedHeader;
    const embedded = header?.jwk;
    if (!header || !embedded || typeof data.publicKey !== "string") {
        throw new Error("Identity block lacks a public key");
    }
    const stated = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(data.publicKey, "base64"));
    const [embeddedThumbprint, statedThumbprint] = await Promise.all([
        jose.calculateJwkThumbprint(embedded),
        jose.calculateJwkThumbprint(stated),
    ]);
    if (embeddedThumbprint !== statedThumbprint) {
        throw new Error("Identity signing key does not match its stated public key");
    }
    if (header.alg !== data.alg) {
        throw new Error("Identity signing algorithm does not match its stated algorithm");
    }

    return new KeyIdentity(cid, data, keys);
}

/**
 * Fetches a public identity by CID (from the local blockstore or the network) and
 * verifies that the block is self-certifying for the key it advertises.
 *
 * @param cid - The identity CID.
 * @param helia - The node to fetch through.
 */
export async function fetchIdentity(cid: CID | string, helia: HeliaNode): Promise<Identity> {
    return loadIdentity(typeof cid === "string" ? CID.parse(cid) : cid, new HeliaStorage(helia));
}

type IdentityDatastore = {
    cid: CID;
    encryptedPrivateKey: jose.FlattenedJWE;
};

const keyName = (name: string) => new Key(`${keyPrefix}/${name}`);

/**
 * Checks if an identity with the given name exists in the datastore.
 * @param name - The name of the identity.
 * @param helia - The instance of Helia.
 * @returns A promise that resolves to a boolean indicating if the identity exists.
 */
export async function hasIdentity(name: string, helia: HeliaNode): Promise<boolean> {
    return await helia.datastore.has(keyName(name));
}

/**
 * Opens an identity with the given name and passphrase.
 *
 * @param name - The name of the identity to open.
 * @param passphrase - The passphrase to decrypt the identity's private key.
 * @param helia - The Helia instance used for data retrieval.
 * @returns The identity, able to sign.
 * @throws An Error if the identity is not found.
 */
export async function openIdentity(
    name: string,
    passphrase: string,
    helia: HeliaNode,
): Promise<SigningIdentity> {
    if (!(await hasIdentity(name, helia))) throw new Error("Identity not found");

    const data = await helia.datastore.get(keyName(name));
    const { cid, encryptedPrivateKey } = HeliaStorage.decode<IdentityDatastore>(data);
    const keys = await importPrivateKey(encryptedPrivateKey, passphrase);
    const heliaStorage = new HeliaStorage(helia);

    return await loadIdentity(cid, heliaStorage, keys);
}

/**
 * Creates a new identity with the given name and passphrase.
 *
 * @param name - The name of the new identity.
 * @param passphrase - The passphrase to encrypt the identity's private key.
 * @param helia - The Helia instance used for data storage.
 * @param alg - The algorithm to use for key generation.
 * @returns The new identity, able to sign.
 * @throws An Error if the identity already exists.
 */
export async function createIdentity(
    name: string,
    passphrase: string,
    helia: HeliaNode,
    alg?: IdentityAlgorithm,
): Promise<SigningIdentity> {
    alg = alg || "ES384";

    if (await hasIdentity(name, helia)) throw new Error("Identity already exists");

    const heliaStorage = new HeliaStorage(helia);
    // jose 6 generates non-extractable keys by default; we export the private key
    // to an (encrypted) JWK and the public key to a JWK string, so both must be
    // extractable.
    const keys = await jose.generateKeyPair(alg, { extractable: true });
    const encryptedPrivateKey = await exportPrivateKey(keys, passphrase, alg);
    const publicKey = await encodePublicKey(keys.publicKey);
    const data: IdentityPayload = {
        version: IDENTITY_VERSION,
        name,
        type: IdentityKind.PublicKey,
        alg,
        publicKey,
    };

    const identityJWS = await createJWS(HeliaStorage.encode(data), keys, { alg, includeJwk: true });
    const cid = await heliaStorage.add(identityJWS);
    const identityDatastore: IdentityDatastore = { cid, encryptedPrivateKey };
    await heliaStorage.datastore.put(keyName(name), HeliaStorage.encode(identityDatastore));

    return new KeyIdentity(cid, data, keys);
}
