import * as jose from "jose";
import { DenkmitHeliaInterface, DenkmitMetadata } from "./utils";

export type KeyPair = Partial<jose.GenerateKeyPairResult>;

export const IDENTITY_VERSION = 1;
export type IdentityVersionType = typeof IDENTITY_VERSION;

export enum IdentityTypes {
    publicKey = 0,
}

export type IdentityAlgorithms = "ES256" | "ES384" | "ES512" | "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512" | "EdDSA" | "RS1";

export type IdentityData = {
    readonly version: IdentityVersionType;
    readonly name: string;
    readonly type: IdentityTypes;
    readonly alg: IdentityAlgorithms;
    readonly publicKey: string;
};

export type IdentityType = IdentityData & DenkmitMetadata;

export type IdentityJWS = jose.FlattenedJWS;

export interface IdentityInterface extends IdentityType {
    verify(jws: jose.FlattenedJWSInput): Promise<Uint8Array | undefined>;
    sign(data: Uint8Array): Promise<jose.FlattenedJWS>;
    signWithoutPayload(data: Uint8Array): Promise<jose.FlattenedJWS>;
    encrypt(data: Uint8Array): Promise<jose.FlattenedJWE>;
    decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | boolean>;
}

export declare function createIdentity(name: string, passphrase: string, helia: DenkmitHeliaInterface, alg?: string): Promise<IdentityInterface>;
export declare function hasIdentity(name: string, helia: DenkmitHeliaInterface): Promise<boolean>;
export declare function openIdentity(name: string, passphrase: string, helia: DenkmitHeliaInterface): Promise<IdentityInterface>;
