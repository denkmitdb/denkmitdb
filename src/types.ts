/**
 * Public contracts of DenkMitDB. Everything a caller needs to type their code is
 * here; implementation types stay internal.
 */
import type { FloodSub } from "@libp2p/floodsub";
import type { Identify } from "@libp2p/identify";
import type { Libp2p } from "@libp2p/interface";
import type { Helia } from "@helia/interface";
import type * as jose from "jose";
import type Keyv from "keyv";
import type { CID } from "multiformats/cid";
import type { IdentityAlgorithm } from "./protocol/identity.js";
import type { PolicyDefinition } from "./protocol/policy.js";
import type { SignedMeta } from "./protocol/signed.js";

/** The libp2p a DenkMitDB node needs: identify + pubsub. */
export type NodeLibp2p = Libp2p<{
    identify: Identify;
    pubsub: FloodSub;
}>;

/**
 * The node DenkMitDB runs on: a Helia 7 instance augmented with a libp2p that
 * provides identify + pubsub (the `@helia/libp2p` mixin shape). Helia 7 removed
 * the libp2p generic from `Helia` itself; the intersection keeps the
 * `helia.libp2p.services.pubsub` surface the sync layer uses.
 */
export type HeliaNode = Helia & { libp2p: NodeLibp2p };

/**
 * A public identity: a self-certifying key whose CID names a writer. Anyone can
 * fetch one ({@link fetchIdentity}) to verify signatures or encrypt to it.
 */
export interface Identity {
    /** The identity CID — the writer's name in provenance and policies. */
    readonly cid: CID;
    readonly name: string;
    readonly alg: IdentityAlgorithm;
    /** base64 of the dag-cbor encoded public JWK. */
    readonly publicKey: string;
    /** Returns the payload if `jws` was signed by this identity, else undefined. */
    verify(jws: jose.FlattenedJWSInput): Promise<Uint8Array | undefined>;
    /** Encrypts to this identity alone (ECDH-ES+A256KW, A256GCM). */
    encrypt(data: Uint8Array): Promise<jose.FlattenedJWE>;
}

/** An identity whose private key is loaded: it can sign writes and decrypt. */
export interface SigningIdentity extends Identity {
    sign(data: Uint8Array): Promise<jose.FlattenedJWS>;
    /** The plaintext, or undefined if the JWE was not encrypted to this identity or fails to verify. */
    decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | undefined>;
}

/** A signed policy, as referenced by a manifest. */
export type Policy = PolicyDefinition & SignedMeta;

/** A database's signed manifest. Its CID is the database address. */
export type Manifest = SignedMeta & {
    readonly version: number;
    readonly timestamp: number;
    readonly name: string;
    readonly type: string;
    /** Pollard order: each Merkle subtree holds 2^order leaves. */
    readonly order: number;
    /** CID of the access (authorization) policy. */
    readonly access: CID;
    /** CID of the validation policy (`consensus` on the wire). */
    readonly validation: CID;
    readonly meta?: Record<string, unknown>;
};

/** Who wrote the current record for a key, and when. */
export type Provenance = {
    /** CID of the signed entry. */
    readonly cid: CID;
    /** Identity CID of the writer. */
    readonly creator: CID;
    readonly timestamp: number;
    /** True when the current record is a tombstone. */
    readonly deleted: boolean;
};

/**
 * Options for a write. `identity` signs the entry instead of the identity the
 * database was opened with — e.g. one of several agent identities a daemon holds
 * (specs/delegation.md, phase 1). Access and validation policies are evaluated for
 * the identity that signs.
 */
export type WriteOptions = {
    identity?: SigningIdentity;
};

/**
 * A signed, replicated key-value database.
 * @typeParam T - The type of values stored in the database.
 */
export interface Database<T> {
    /** The database address: the CID of its signed manifest. */
    readonly address: CID;
    /** The identity that signs this replica's writes by default. */
    readonly identity: SigningIdentity;
    readonly manifest: Manifest;
    /** The policies the manifest binds; every replica evaluates the same ones. */
    readonly policies: { readonly access: Policy; readonly validation: Policy };
    /** Number of records, tombstones included. */
    readonly size: number;

    /** The current value of `key`, or undefined if it was never written or is deleted. */
    get(key: string): Promise<T | undefined>;
    /** Signs and stores a value for `key`; rejects if the policies refuse the write. */
    set(key: string, value: T, options?: WriteOptions): Promise<void>;
    /**
     * Deletes `key` by writing a signed tombstone. The tombstone takes part in the
     * same last-write-wins order as puts: while it wins, the key is hidden from
     * `get`/`keys`/`iterator`; a newer `set` resurrects it.
     */
    delete(key: string, options?: WriteOptions): Promise<void>;
    /** Provenance of the current record for `key` (tombstones too), or undefined if never written. */
    provenance(key: string): Promise<Provenance | undefined>;
    /** Live keys in write-time order, without loading values. */
    keys(): AsyncGenerator<string>;
    /** Live key-value pairs in write-time order. */
    iterator(): AsyncGenerator<[key: string, value: T]>;
    /**
     * Resolves once this replica's queued work (tree rebuilds, merges) has
     * drained. Local only: it says nothing about convergence with peers.
     */
    idle(): Promise<void>;
    /**
     * Re-announces the current head to peers even when it has not changed, so
     * peers that connected after the last change can converge.
     */
    announceHead(): Promise<void>;
    /** Stops sync, finishes pending work and persists the head. */
    close(): Promise<void>;
}

/**
 * Access preset for a new database (create only — open always reads the policy
 * from the signed manifest). Compiles to a json-logic access policy:
 * - "creator-only" (default): only the creating identity writes.
 * - "public": any identity writes (provenance still attributes every record).
 * - "prefix-per-writer": the creator writes anywhere; any other identity writes
 *   (and deletes) only under `agents/<its-identity-cid>/…`.
 * - "namespace-per-writer": every identity, the creator included, writes and
 *   deletes only under `agents/<its-identity-cid>/…` — no privileged party.
 * - `{ allowlist }`: exactly the listed identity CIDs write.
 *
 * See docs/policies.md.
 */
export type AccessPreset =
    | "creator-only"
    | "public"
    | "prefix-per-writer"
    | "namespace-per-writer"
    | { allowlist: string[] };

/** Options for opening a database. */
export type DatabaseOptions<T> = {
    helia: HeliaNode;
    identity: SigningIdentity;
    /**
     * Value cache keyed by entry CID. Entry values never change, so one cache may
     * be shared between databases. Default: a private in-memory Keyv.
     */
    cache?: Keyv<T>;
};

/** Options for creating a database: the open options plus what the manifest fixes for good. */
export type CreateDatabaseOptions<T> = DatabaseOptions<T> & {
    /** Pollard order, an integer in [1, 8]; default 3. */
    order?: number;
    /** Custom validation policy. Default accepts every authorized entry. */
    validationPolicy?: PolicyDefinition;
} & (
        | {
              /** An access preset; default "creator-only". */
              access?: AccessPreset;
              accessPolicy?: never;
          }
        | {
              access?: never;
              /** A custom json-logic access policy instead of a preset. */
              accessPolicy: PolicyDefinition;
          }
    );
