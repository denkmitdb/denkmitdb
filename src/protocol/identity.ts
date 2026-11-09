export const IDENTITY_VERSION = 1;

/** Identity kinds. Numeric on the wire. */
export enum IdentityKind {
    PublicKey = 0,
}

export type IdentityAlgorithm =
    | "ES256"
    | "ES384"
    | "ES512"
    | "RS256"
    | "RS384"
    | "RS512"
    | "PS256"
    | "PS384"
    | "PS512"
    | "EdDSA"
    | "RS1";

/**
 * The self-signed identity payload. The block is a JWS over it with the same key
 * embedded in the header; its CID is the identity CID.
 */
export type IdentityPayload = {
    readonly version: typeof IDENTITY_VERSION;
    readonly name: string;
    readonly type: IdentityKind;
    readonly alg: IdentityAlgorithm;
    /** base64 of the dag-cbor encoded public JWK. */
    readonly publicKey: string;
};
