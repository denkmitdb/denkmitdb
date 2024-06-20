import { Key } from "interface-datastore";
import * as jose from "jose";
import { CID } from "multiformats/cid";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";

import {
    IDENTITY_VERSION,
    IdentityAlgorithms,
    IdentityConfig,
    IdentityData,
    IdentityInterface,
    IdentityJWS,
    IdentityType,
    IdentityTypes,
    KeyPair
} from "../types";

import { Optional } from "utility-types";
import { HeliaStorage } from "./utils/helia";

const keyPrefix = "/Denkmit/";

class Identity implements IdentityInterface {
    readonly version = IDENTITY_VERSION;
    readonly cid: CID;
    readonly name: string;
    readonly type: IdentityTypes;
    readonly alg: IdentityAlgorithms;
    readonly publicKey: string;
    readonly link: CID;
    readonly creator: CID;
    private keys: KeyPair;

    constructor(identity: Optional<IdentityType, "creator">, keys?: KeyPair) {
        this.version = identity.version || IDENTITY_VERSION;
        this.cid = identity.cid;
        this.name = identity.name;
        this.type = identity.type;
        this.alg = identity.alg;
        this.publicKey = identity.publicKey;
        this.keys = keys || {};
        this.link = identity.link;
        this.creator = identity.creator || this.cid;
    }

    toJSON(): IdentityData {
        return {
            version: this.version,
            name: this.name,
            type: this.type,
            alg: this.alg,
            publicKey: this.publicKey,
        };
    }

    private async getPublicKeyLike(): Promise<jose.KeyLike> {
        if (this.keys.publicKey) return this.keys.publicKey;

        const publicJwk = HeliaStorage.decode<jose.JWK>(uint8ArrayFromString(this.publicKey, "base64"));
        const pk = await jose.importJWK(publicJwk);
        if (pk instanceof Uint8Array) throw new Error("Public key is not available");
        this.keys.publicKey = pk;

        return this.keys.publicKey;
    }

    async verify(jws: jose.FlattenedJWSInput): Promise<Uint8Array | undefined> {
        const protectedHeader = jose.decodeProtectedHeader(jws);
        const kid = protectedHeader.kid;

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

    async sign(data: Uint8Array): Promise<jose.FlattenedJWS> {
        if (!this.keys.privateKey) throw new Error("Private key is not available");

        return await createJWS(data, this.keys, { alg: this.alg, kid: this.cid.toString(), includeJwk: false });
    }

    async signWithoutPayload(data: Uint8Array): Promise<jose.FlattenedJWS> {
        if (!this.keys.privateKey) throw new Error("Private key is not available");

        return await createJWS(data, this.keys, { alg: this.alg, kid: this.cid.toString(), includeJwk: false, includePayload: false });
    }

    async encrypt(data: Uint8Array): Promise<jose.FlattenedJWE> {
        const pk = await this.getPublicKeyLike();

        return await new jose.FlattenedEncrypt(data)
            .setProtectedHeader({ alg: "ECDH-ES+A256KW", kid: this.cid.toString(), enc: "A256GCM" })
            .encrypt(pk);
    }

    async decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | boolean> {
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

    const jwk = await jose.exportJWK(keys.privateKey);
    const encryptedPrivateKey = await new jose.FlattenedEncrypt(HeliaStorage.encode(jwk))
        .setProtectedHeader({ alg: "PBES2-HS256+A128KW", enc: "A128GCM" })
        .encrypt(uint8ArrayFromString(passphrase));

    return encryptedPrivateKey;
}

async function importPrivateKey(encryptedPrivateKey: jose.FlattenedJWE, passphrase: string): Promise<KeyPair> {
    const result = await jose.flattenedDecrypt(encryptedPrivateKey, uint8ArrayFromString(passphrase), {
        keyManagementAlgorithms: ["PBES2-HS256+A128KW"],
        contentEncryptionAlgorithms: ["A128GCM"],
    });

    const privateJwk = HeliaStorage.decode<jose.JWK>(result.plaintext);
    const privateKey = await jose.importJWK(privateJwk);
    if (privateKey instanceof Uint8Array) throw new Error("Cannot import private key");

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

async function createJWS(payload: Uint8Array, keys: KeyPair, options?: createJWSOptions ): Promise<jose.FlattenedJWS> {
    options = options || { alg: "ES384" };
    const { alg, kid } = options;
    let { includeJwk, includePayload } = options;
    includeJwk = includeJwk || false;
    includePayload = includePayload || true;

    const headers: jose.JWSHeaderParameters = { alg, kid };
    if (!keys.privateKey) throw new Error("Private key is not available");

    if (keys.publicKey && includeJwk)
        headers.jwk = await jose.exportJWK(keys.publicKey);

    if (!includePayload) {
        headers.b64 = false;
        headers.crit = ["b64"];
    }

    return await new jose.FlattenedSign(payload).setProtectedHeader(headers).sign(keys.privateKey);
}

export async function fetchIdentity(cid: CID, heliaStorage: HeliaStorage, keys?: KeyPair): Promise<IdentityInterface> {
    const identityJWS = await heliaStorage.get<IdentityJWS>(cid);
    if (!identityJWS) throw new Error("Identity not found");

    const verifyResult = await jose.flattenedVerify(identityJWS, jose.EmbeddedJWK);
    const identityInput: IdentityData = HeliaStorage.decode(verifyResult.payload);
    const identity: IdentityType = { ...identityInput, cid, link: cid, creator: cid};

    return new Identity(identity, keys);
}

type IdentityDatastore = {
    cid: CID;
    encryptedPrivateKey: jose.FlattenedJWE;
};

export async function createIdentity(config: IdentityConfig): Promise<IdentityInterface> {
    const alg = config.alg || "ES384";
    const name = config.name || "default";
    const passphrase = config.passphrase || "password";
    const key = new Key(`${keyPrefix}/${name}`);

    const heliaStorage = new HeliaStorage(config.helia);

    if (await heliaStorage.datastore.has(key)) {
        const data = await heliaStorage.datastore.get(key);
        const { cid, encryptedPrivateKey } = HeliaStorage.decode<IdentityDatastore>(data);
        const keys = await importPrivateKey(encryptedPrivateKey, passphrase);

        return await fetchIdentity(cid, heliaStorage, keys);
    } else {
        const keys = await jose.generateKeyPair(alg);
        const encryptedPrivateKey = await exportPrivateKey(keys, passphrase);
        const publicKey = await encodePublicKey(keys.publicKey);
        const identityToSign: IdentityData = {
            version: IDENTITY_VERSION,
            name,
            type: IdentityTypes.publicKey,
            alg,
            publicKey,
        };

        const identityJWS = await createJWS(HeliaStorage.encode(identityToSign), keys, { alg, includeJwk: true });
        const cid = await heliaStorage.add(identityJWS);
        const identity: IdentityType = { ...identityToSign, cid, link: cid, creator: cid};
        const identityDatastore: IdentityDatastore = {
            cid,
            encryptedPrivateKey,
        };

        await heliaStorage.datastore.put(key, HeliaStorage.encode(identityDatastore));

        return new Identity(identity, keys);
    }
}
