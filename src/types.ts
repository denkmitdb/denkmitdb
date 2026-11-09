/**
 * Public contracts of DenkMitDB. Everything a caller needs to type their code is
 * here; implementation types stay internal.
 */
import type { FloodSub } from "@libp2p/floodsub";
import type { Identify } from "@libp2p/identify";
import type { Libp2p } from "@libp2p/interface";
import type { Helia } from "@helia/interface";
import type * as jose from "jose";
import type { CID } from "multiformats/cid";
import type { IdentityAlgorithm } from "./protocol/identity.js";
import type { PolicyDefinition } from "./protocol/policy.js";

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
    /**
     * Returns the payload if the signature verifies, else undefined.
     * @throws Error - If `jws` names no key or another identity (`kid`), or its header is malformed.
     */
    verify(jws: jose.FlattenedJWSInput): Promise<Uint8Array | undefined>;
    /** Encrypts to this identity alone (ECDH-ES+A256KW, A256GCM). */
    encrypt(data: Uint8Array): Promise<jose.FlattenedJWE>;
}

/** An identity whose private key is loaded: it can sign writes and decrypt. */
export interface SigningIdentity extends Identity {
    sign(data: Uint8Array): Promise<jose.FlattenedJWS>;
    /**
     * The plaintext, or undefined if decryption or authentication fails.
     * @throws Error - If `jwe` names no key or another identity (`kid`), or its header is malformed.
     *   {@link decryptValue} never throws; prefer it for stored values.
     */
    decrypt(jwe: jose.FlattenedJWE): Promise<Uint8Array | undefined>;
}

/** A signed policy, as referenced by a manifest. */
export type SignedPolicy = PolicyDefinition & {
    /** CID of the signed policy block. */
    readonly cid: CID;
    /** Identity CID of the signer (the database creator). */
    readonly creator: CID;
};

/**
 * Consensus rules: what every replica enforces identically, so replicas that see
 * the same signed entries reach the same state. Both rules are deterministic
 * json-logic, signed into the manifest for good (docs/policies.md).
 */
export type Consensus<P> = {
    /** Who may write (and delete) which keys. */
    readonly access: P;
    /** Which authorized, signed entries are valid. */
    readonly validity: P;
};

/** A database's signed manifest. Its CID is the database address. */
export type Manifest = {
    /** The database address. */
    readonly cid: CID;
    /** Identity CID of the database creator. */
    readonly creator: CID;
    readonly version: number;
    readonly timestamp: number;
    readonly name: string;
    readonly type: string;
    /** Leaves per Merkle subtree (a power of two; `order` = log2 on the wire). */
    readonly subtreeLeaves: number;
    /** CIDs of the consensus rules (wire keys: `access`, and `consensus` for validity). */
    readonly consensus: Consensus<CID>;
    readonly metadata?: Record<string, unknown>;
};

/** Who wrote the current record for a key, and when. */
export type Provenance = {
    /** CID of the signed entry. */
    readonly entryCid: CID;
    /** Identity CID of the entry's writer (signer). */
    readonly writer: CID;
    /** Write time claimed by the writer (ms since the epoch). */
    readonly timestamp: number;
    /** True when the current record is a tombstone. */
    readonly deleted: boolean;
};

/**
 * Options for a write. `identity` signs the entry instead of the identity the
 * database was opened with — e.g. one of several agent identities a daemon holds
 * (specs/delegation.md, phase 1). The consensus rules are evaluated for the
 * identity that signs.
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
    /** The signed consensus rules the manifest binds; every replica evaluates the same ones. */
    readonly consensus: Consensus<SignedPolicy>;
    /** Number of records (one per key ever written), tombstones included. */
    readonly recordCount: number;

    /** The current value of `key`, or undefined if it was never written or is deleted. */
    get(key: string): Promise<T | undefined>;
    /** Signs and stores a value for `key`; rejects if the consensus rules refuse the write. */
    set(key: string, value: T, options?: WriteOptions): Promise<void>;
    /**
     * Deletes `key` by writing a signed tombstone. The tombstone takes part in the
     * same last-write-wins order as puts: while it wins, the key is hidden from
     * `get`/`keys`/`entries`; a newer `set` resurrects it.
     */
    delete(key: string, options?: WriteOptions): Promise<void>;
    /** Provenance of the current record for `key` (tombstones too), or undefined if never written. */
    provenance(key: string): Promise<Provenance | undefined>;
    /** Live keys in write-time order, without loading values. */
    keys(): AsyncGenerator<string>;
    /** Live key-value pairs in write-time order. */
    entries(): AsyncGenerator<[key: string, value: T]>;
    /**
     * Resolves once this replica's queued work (tree rebuilds, merges) has
     * drained. Local only: it says nothing about convergence with peers.
     */
    waitUntilIdle(): Promise<void>;
    /**
     * Re-announces the current head to peers even when it has not changed, so
     * peers that connected after the last change can converge.
     */
    announceHead(): Promise<void>;
    /** Stops sync, finishes pending work and persists the head. */
    close(): Promise<void>;
}

/**
 * The access rule of a new database (create only — open always reads it from the
 * signed manifest). A preset compiles to a json-logic policy:
 * - "creator-only" (default): only the creating identity writes.
 * - "public": any identity writes (provenance still attributes every record).
 * - "prefix-per-writer": the creator writes anywhere; any other identity writes
 *   (and deletes) only under `agents/<its-identity-cid>/…`.
 * - "namespace-per-writer": every identity, the creator included, writes and
 *   deletes only under `agents/<its-identity-cid>/…` — no privileged party.
 * - `{ allowlist }`: exactly the listed identity CIDs write.
 * - `{ policy }`: a custom json-logic access policy.
 *
 * See docs/policies.md.
 */
export type AccessRule =
    | "creator-only"
    | "public"
    | "prefix-per-writer"
    | "namespace-per-writer"
    | { allowlist: string[] }
    | { policy: PolicyDefinition };

/**
 * A value cache keyed by entry CID. A Keyv instance fits; so does any store with
 * these methods. Entry values never change, so one cache may be shared between
 * databases.
 */
export interface ValueCache<T> {
    get(key: string): Promise<T | undefined>;
    set(key: string, value: T): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    clear(): Promise<void>;
}

/** Options for opening a database. */
export type DatabaseOptions<T> = {
    helia: HeliaNode;
    identity: SigningIdentity;
    /** Default: a private in-memory cache, cleared on close (a supplied one never is). */
    valueCache?: ValueCache<T>;
};

/** Options for creating a database: the open options plus what the manifest fixes for good. */
export type CreateDatabaseOptions<T> = DatabaseOptions<T> & {
    /** Leaves per Merkle subtree: a power of two in [2, 256]; default 8. */
    subtreeLeaves?: number;
    /** Consensus rules. Default: access "creator-only", validity accepts every authorized entry. */
    consensus?: {
        access?: AccessRule;
        validity?: PolicyDefinition;
    };
};
