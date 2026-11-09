import type { CID } from "multiformats/cid";

/** Where a signed record is stored and who signed it. */
export type SignedMeta = {
    /** CID of the signed block (a dag-cbor encoded JWS over the payload). */
    readonly cid: CID;
    /** Identity CID of the signer — verified, never taken from the payload. */
    readonly creator: CID;
};

/** A verified signed block together with its decoded payload. */
export type Signed<P> = SignedMeta & { readonly data: P };
