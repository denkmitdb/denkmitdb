import { Key } from "interface-datastore";
import * as jose from "jose";
import { CID } from "multiformats/cid";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";

import {
    DenkmitData,
    DenkmitHeliaInterface,
    IDENTITY_VERSION,
    IdentityAlgorithms,
    IdentityData,
    IdentityInterface,
    IdentityJWS,
    IdentityTypes,
    KeyPair,
} from "../types";

import { HeliaStorage } from "./utils/helia";

const keyPrefix = "/Denkmit/";

/**
 * Represents an identity with various properties and methods for signing, verifying, encrypting, and decrypting data.
 */
class Identity implements IdentityInterface {
    readonly version = IDENTITY_VERSION;
    readonly name: string;
    readonly type: IdentityTypes;
    readonly alg: IdentityAlgorithms;
    readonly publicKey: string;

    readonly cid: CID;
    readonly creator: CID;
    readonly link?: CID;

    private keys: KeyPair;

    /**
     * Creates a new instance of the Identity class.
     * @param identity - The DenkmitData object containing the identity data.
     * @param keys - Optional KeyPair object containing the public and private keys.
     */
    constructor(identity: DenkmitData<IdentityData>, keys?: KeyPair) {
        this.version = identity.data.version || IDENTITY_VERSION;
        this.name = identity.data.name;
        this.type = identity.data.type;
        this.alg = identity.data.alg;
        this.publicKey = identity.data.publicKey;

        this.cid = identity.cid;
        this.creator = identity.creator || this.cid;
        this.link = identity.link;

        this.keys = keys || {};
    }

    /**
     * Converts the Identity object to a JSON representation.
     * @returns The JSON representation of the Identity object.
     */
    toJSON(): IdentityData {
        return {
            version: this.version,
            name: this.name,
            type: this.type,
            alg: this.alg,
            publicKey: this.publicKey,
        };
    }

    /**
     * Retrieves the public key in a format compatible with the jose library.
     * @returns A promise that resolves to the public key in jose.KeyLike format.
     * @internal
     */
    private async getPublicKeyLike(): Promise<jose.KeyLike> {
        if (this.keys.publicKey) return this.keys.publicKey;

        const publicJwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(this.publicKey, "base64"));
        this.keys.publicKey = (await jose.importJWK(publicJwk)) as jose.KeyLike;

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
        } catch (error) {
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
     * Signs the given data without including the payload in the resulting JWS.
     * @param data - The data to sign.
     * @returns A promise that resolves to the JWS (JSON Web Signature) of the signed data.
     */
    async signWithoutPayload(data: Uint8Array): Promise<jose.FlattenedJWS> {
        if (!this.keys.privateKey) throw new Error("Private key is not available");

        return await createJWS(data, this.keys, {
            alg: this.alg,
            kid: this.cid.toString(),
            includeJwk: false,
            includePayload: false,
        });
    }

    /**
     * Encrypts the given data using the public key associated with the identity.
     * @param data - The data to encrypt.
     * @returns A promise that resolves to the JWE (JSON Web Encryption) of the encrypted data.
     */
    async encrypt(data: Uint8Array): Promise<jose.FlattenedJWE> {
        const pk = await this.getPublicKeyLike();

        return await new jose.FlattenedEncrypt(data)
            .setProtectedHeader({ alg: "ECDH-ES+A256KW", kid: this.cid.toString(), enc: "A256GCM" })
            .encrypt(pk);
    }

    /**
     * Decrypts the given JWE (JSON Web Encryption) using the private key associated with the identity.
     * @param jwe - The JWE to decrypt.
     * @returns A promise that resolves to the plaintext of the decrypted data if decryption is successful, or false otherwise.
     */
    async decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | boolean> {
        const { kid } = jose.decodeProtectedHeader(jwe);
        if (!kid) throw new Error("Key ID not found in JWE header");
        if (kid !== this.cid.toString()) throw new Error("Key ID does not match identity ID");

        if (!this.keys.privateKey) throw new Error("Private key is not available");

        try {
            const result = await jose.flattenedDecrypt(jwe, this.keys.privateKey);
            return result.plaintext;
        } catch (error) {
            return false;
        }
    }
}

async function exportPrivateKey(keys: KeyPair, passphrase: string): Promise<jose.FlattenedJWE> {
    if (!keys.privateKey) throw new Error("Private key is not available");

    const encryptionConfig = { alg: "PBES2-HS256+A128KW", enc: "A128GCM" };

    const jwk = await jose.exportJWK(keys.privateKey);
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
    const privateKey = (await jose.importJWK(jwk)) as jose.KeyLike;

    return { privateKey };
}

async function encodePublicKey(publicKey: jose.KeyLike): Promise<string> {
    const publicJwk = await jose.exportJWK(publicKey);
    return uint8ArrayToString(HeliaStorage.encode(publicJwk), "base64");
}

type createJWSOptions = {
    alg: string;
    kid?: string;
    includeJwk?: boolean;
    includePayload?: boolean;
};

async function createJWS(payload: Uint8Array, keys: KeyPair, options?: createJWSOptions): Promise<jose.FlattenedJWS> {
    options = options || { alg: "ES384" };
    const { alg, kid } = options;
    let { includeJwk, includePayload } = options;
    includeJwk = includeJwk || false;
    includePayload = includePayload || true;

    const headers: jose.JWSHeaderParameters = { alg, kid };
    if (!keys.privateKey) throw new Error("Private key is not available");

    if (keys.publicKey && includeJwk) headers.jwk = await jose.exportJWK(keys.publicKey);

    if (!includePayload) {
        headers.b64 = false;
        headers.crit = ["b64"];
    }

    return await new jose.FlattenedSign(payload).setProtectedHeader(headers).sign(keys.privateKey);
}

export async function fetchIdentity(cid: CID, heliaStorage: HeliaStorage, keys?: KeyPair): Promise<IdentityInterface> {
    const identityJWS = await heliaStorage.get<IdentityJWS>(cid);
    if (!identityJWS) throw new Error("Identity not found");

    const verified = await jose.flattenedVerify(identityJWS, jose.EmbeddedJWK);
    const data: IdentityData = HeliaStorage.decode(verified.payload);
    const identity: DenkmitData<IdentityData> = { data, cid, creator: cid };

    return new Identity(identity, keys);
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
export async function hasIdentity(name: string, helia: DenkmitHeliaInterface): Promise<boolean> {
    return await helia.datastore.has(keyName(name));
}

/**
 * Opens an identity with the given name and passphrase.
 *
 * @param name - The name of the identity to open.
 * @param passphrase - The passphrase to decrypt the identity's private key.
 * @param helia - The Helia instance used for data retrieval.
 * @returns A Promise that resolves to the opened IdentityInterface.
 * @throws An Error if the identity is not found.
 */
export async function openIdentity(
    name: string,
    passphrase: string,
    helia: DenkmitHeliaInterface,
): Promise<IdentityInterface> {
    if (!(await hasIdentity(name, helia))) throw new Error("Identity not found");

    const data = await helia.datastore.get(keyName(name));
    const { cid, encryptedPrivateKey } = HeliaStorage.decode<IdentityDatastore>(data);
    const keys = await importPrivateKey(encryptedPrivateKey, passphrase);
    const heliaStorage = new HeliaStorage(helia);

    return await fetchIdentity(cid, heliaStorage, keys);
}

/**
 * Creates a new identity with the given name and passphrase.
 *
 * @param name - The name of the new identity.
 * @param passphrase - The passphrase to encrypt the identity's private key.
 * @param helia - The Helia instance used for data storage.
 * @param alg - The algorithm to use for key generation.
 * @returns A Promise that resolves to the created IdentityInterface.
 * @throws An Error if the identity already exists.
 */
export async function createIdentity(
    name: string,
    passphrase: string,
    helia: DenkmitHeliaInterface,
    alg?: IdentityAlgorithms,
): Promise<IdentityInterface> {
    alg = alg || "ES384";

    if (await hasIdentity(name, helia)) throw new Error("Identity already exists");

    const heliaStorage = new HeliaStorage(helia);
    const keys = await jose.generateKeyPair(alg);
    const encryptedPrivateKey = await exportPrivateKey(keys, passphrase);
    const publicKey = await encodePublicKey(keys.publicKey);
    const data: IdentityData = {
        version: IDENTITY_VERSION,
        name,
        type: IdentityTypes.publicKey,
        alg,
        publicKey,
    };

    const identityJWS = await createJWS(HeliaStorage.encode(data), keys, { alg, includeJwk: true });
    const cid = await heliaStorage.add(identityJWS);
    const identityDatastore: IdentityDatastore = { cid, encryptedPrivateKey };
    await heliaStorage.datastore.put(keyName(name), HeliaStorage.encode(identityDatastore));

    const identity: DenkmitData<IdentityData> = { data, cid, creator: cid };

    return new Identity(identity, keys);
}
