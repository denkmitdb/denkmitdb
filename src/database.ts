import type { Logger } from "@libp2p/interface";
import type { RulesLogic } from "json-logic-js";
import { Key } from "interface-datastore";
import Keyv from "keyv";
import { CID } from "multiformats/cid";
import { createEntry, createTombstone, type Entry, fetchEntry } from "./entry.js";
import { createHead, fetchHead, type Head } from "./head.js";
import { createManifest, fetchManifest } from "./manifest.js";
import { createPolicy, evaluatePolicy, fetchPolicy } from "./policy.js";
import { createEmptyPollard, createPollard, Pollard } from "./pollard/index.js";
import type { PollardLocation, PollardNode, PollardType } from "./pollard/types.js";
import { ENTRY_VERSION, LEGACY_ENTRY_VERSION } from "./protocol/entry.js";
import { HEAD_VERSION, type HeadPayload } from "./protocol/head.js";
import {
    KEY_VALUE_DATABASE_TYPE,
    LEGACY_MANIFEST_VERSION,
    MANIFEST_VERSION,
    type ManifestPayload,
} from "./protocol/manifest.js";
import { assertPolicyDefinition, type PolicyDefinition } from "./protocol/policy.js";
import { Leaf, LeafKind, POLLARD_VERSION } from "./protocol/tree.js";
import { HeliaController } from "./storage/helia.js";
import { SortedItemsStore } from "./storage/sortedItems.js";
import { createSyncController, SyncController } from "./sync.js";
import type {
    AccessRule,
    Consensus,
    CreateDatabaseOptions,
    Database,
    DatabaseOptions,
    Manifest,
    SignedPolicy,
    Provenance,
    SigningIdentity,
    ValueCache,
    WriteOptions,
} from "./types.js";

/** Key prefix for everything a database keeps in the node's datastore. */
export const DENKMITDB_PREFIX = "/denkmitdb/";

/** Internal-only options: tests inject their own sync controller. */
type InternalOptions = { syncController?: SyncController };

/** What a database instance is built from. */
type DatabaseInit<T> = {
    manifest: Manifest;
    heliaController: HeliaController;
    valueCache?: ValueCache<T>;
    syncController: SyncController;
    consensus: Consensus<SignedPolicy>;
};

/**
 * Upper bound on the number of entries a head may describe. It bounds the layer
 * count a peer can claim (2^40 entries ≈ 10^12), and with it how deep tree
 * comparison and bulk load may walk (KNOWN_ISSUES.md #26).
 */
const MAX_ENTRIES_LOG2 = 40;

/** The largest layer count a head may claim for a tree of the given order. */
export function maxHeadLayers(order: number): number {
    return Math.ceil(MAX_ENTRIES_LOG2 / order) + 1;
}

/** What a signed entry does to its key — a deterministic policy input. */
type EntryOperation = "put" | "delete";

function operationOf(entry: { deleted?: boolean }): EntryOperation {
    return entry.deleted === true ? "delete" : "put";
}

/**
 * Thrown while walking a peer's tree when it is structurally impossible for an
 * honest replica to have built it (repeated pollards, wrong order or width, more
 * pollards than its claimed size allows). The whole head is then dropped.
 */
class TreeRejectedError extends Error {}

/**
 * Per-head budget for walking a peer's tree. Content addressing lets a hostile
 * peer build a DAG whose pollards link the same child many times, which a naive
 * walk visits exponentially often; an honest tree never repeats a pollard, so a
 * repeat rejects the head. The pollard count is also capped by what the head's
 * claimed size allows (KNOWN_ISSUES.md #26).
 */
class TreeWalkBudget {
    private readonly seen = new Set<string>();
    constructor(private readonly maxPollards: number) {}

    visit(cid: CID): void {
        const key = cid.toString();
        if (this.seen.has(key)) throw new TreeRejectedError(`pollard ${key} appears more than once`);
        this.seen.add(key);
        if (this.seen.size > this.maxPollards) throw new TreeRejectedError("more pollards than the head's size allows");
    }
}

/**
 * Datastore key holding the CID of the last locally built head for a database,
 * namespaced by manifest CID (KNOWN_ISSUES.md D4). Durability follows the stores the
 * caller gives Helia: with a persistent datastore/blockstore the database reopens
 * from its own head with no live peer; with in-memory stores the pointer lives as
 * long as the Helia node.
 *
 * @param manifestCid - The database address (manifest CID).
 * @returns The datastore key for the persisted head pointer.
 */
export function headStoreKey(manifestCid: CID): Key {
    return new Key(`${DENKMITDB_PREFIX}head/${manifestCid.toString()}`);
}

/**
 * The pubsub topic a database syncs on. Derived from the manifest CID (the database
 * address), not its name, so distinct databases that happen to share a name do not
 * share a topic (KNOWN_ISSUES.md D5). Versioned so a future wire change can move to a
 * new topic namespace.
 *
 * @param manifestCid - The database address (manifest CID).
 * @returns The versioned, manifest-scoped topic string.
 */
export function syncTopic(manifestCid: CID): string {
    return `${DENKMITDB_PREFIX}2/${manifestCid.toString()}`;
}

/**
 * Creates a database: signs its policies and manifest and starts syncing.
 *
 * @param name - The database name (part of the manifest, not unique).
 * @param options - Node, identity, and what the manifest fixes for good.
 * @typeParam T - The type of values stored in the database.
 */
export async function createDatabase<T>(
    name: string,
    options: CreateDatabaseOptions<T> & InternalOptions,
): Promise<DenkmitDatabase<T>> {
    refuseRemovedOptions(options);
    const identity = options.identity;
    const heliaController = new HeliaController(options.helia, identity);

    // Validity rule: accept every authorized entry unless the caller supplies its
    // own (custom rules are checked before they are signed in for good). The default
    // policy's name and description are part of its signed bytes — keep them.
    const validityRule: PolicyDefinition = options.consensus?.validity ?? {
        version: 1,
        name: "denkmit-timestamp",
        description: "Consensus for denkmit database timestamp",
        logic: true,
    };
    assertPolicyDefinition(validityRule, "consensus.validity");
    const validityPolicy = await createPolicy(validityRule, heliaController);

    // Access rule: a preset compiled to json-logic over deterministic inputs only
    // (signed entry writer, key and operation, manifest creator), so every replica
    // reaches the same decision (KNOWN_ISSUES.md D1, specs/ordering.md,
    // docs/policies.md), or a custom policy. Default: creator-only.
    const accessPolicy = await createPolicy(compileAccess(options.consensus?.access), heliaController);

    const subtreeLeaves = options.subtreeLeaves ?? 8;
    const order = Math.log2(subtreeLeaves);
    if (!Number.isInteger(order) || order < 1 || order > 8) {
        throw new Error("subtreeLeaves must be a power of two in [2, 256]");
    }

    const manifestInput: ManifestPayload = {
        version: MANIFEST_VERSION,
        name,
        type: KEY_VALUE_DATABASE_TYPE,
        order,
        consensus: validityPolicy.cid,
        access: accessPolicy.cid,
        timestamp: Date.now(),
    };
    const manifest = await createManifest(manifestInput, heliaController);
    const syncController =
        options.syncController ?? (await createSyncController(syncTopic(manifest.cid), heliaController));

    const mdb: DatabaseInit<T> = {
        manifest,
        heliaController,
        valueCache: options.valueCache,
        syncController,
        consensus: { access: accessPolicy, validity: validityPolicy },
    };
    const dmdb = new DenkmitDatabase<T>(mdb);
    await dmdb.setupSync();

    return dmdb;
}

/**
 * Options renamed or moved before 4.0.0. Passing one from plain JavaScript would
 * otherwise be ignored silently — and for the consensus rules that would sign a
 * different, permanent manifest than intended.
 */
const REMOVED_OPTIONS: Record<string, string> = {
    access: "consensus.access",
    accessPolicy: "consensus.access: { policy }",
    validationPolicy: "consensus.validity",
    publicWrite: 'consensus.access: "public"',
    order: "subtreeLeaves (2 ** order)",
    cache: "valueCache",
    keyValueStorage: "valueCache",
};

function refuseRemovedOptions(options: object): void {
    for (const [old, now] of Object.entries(REMOVED_OPTIONS)) {
        if (old in options) throw new Error(`Option \`${old}\` was removed: use ${now}`);
    }
}

/**
 * Opens a database by address: fetches and verifies its manifest and policies,
 * restores the locally persisted head, and starts syncing.
 *
 * @param address - The database address (manifest CID).
 * @param options - Node and identity.
 * @typeParam T - The type of values stored in the database.
 */
export async function openDatabase<T>(
    address: CID | string,
    options: DatabaseOptions<T> & InternalOptions,
): Promise<DenkmitDatabase<T>> {
    refuseRemovedOptions(options);
    const cid = typeof address === "string" ? CID.parse(address) : address;
    const identity = options.identity;
    const heliaController = new HeliaController(options.helia, identity);
    const manifest = await fetchManifest(cid, heliaController);
    const syncController = options.syncController ?? (await createSyncController(syncTopic(manifest.cid), heliaController));
    // The consensus rules are part of the database identity — always read them from
    // the signed manifest, never from local options (a local override would let
    // replicas disagree on who may write, breaking convergence — KNOWN_ISSUES.md #19).
    const consensus = {
        access: await fetchPolicy(manifest.consensus.access, heliaController),
        validity: await fetchPolicy(manifest.consensus.validity, heliaController),
    };

    const mdb: DatabaseInit<T> = {
        manifest,
        heliaController,
        valueCache: options.valueCache,
        syncController,
        consensus,
    };

    const dmdb = new DenkmitDatabase<T>(mdb);
    await dmdb.setupSync();

    // Restore the last locally persisted head, if any (D4). Goes through
    // syncNewHead, so the head is re-validated exactly like a remote announcement
    // (signature, manifest binding, format version, per-entry authentication and
    // authorization) — a tampered pointer can degrade only to an empty database.
    const pointerKey = headStoreKey(manifest.cid);
    if (await heliaController.datastore.has(pointerKey)) {
        const pointer = await heliaController.datastore.get(pointerKey);
        await dmdb.syncNewHead(pointer);
    }

    return dmdb;
}

/** An access rule other than a custom policy. */
type AccessPreset = Exclude<AccessRule, { policy: PolicyDefinition }>;

/**
 * Compiles the access rule of a new database to the policy signed into its manifest.
 *
 * @param rule - A preset, an allowlist or a custom policy; default "creator-only".
 */
function compileAccess(rule: AccessRule | undefined): PolicyDefinition {
    if (typeof rule === "object" && rule !== null && "policy" in rule) {
        if ("allowlist" in rule) throw new Error("consensus.access is either { allowlist } or { policy }, not both");
        assertPolicyDefinition(rule.policy, "consensus.access.policy");
        return rule.policy;
    }
    return accessPolicyRule(resolveAccess(rule));
}

/**
 * Validates the access preset for a new database (default "creator-only"). Allowlist entries
 * must be identity CIDs and are normalized to the string form `entryCreator`
 * takes at evaluation time, so a differently encoded CID cannot silently fail to
 * match.
 *
 * @param access - The requested preset.
 * @returns The validated preset.
 */
function resolveAccess(access: AccessPreset | undefined): AccessPreset {
    const preset: AccessPreset = access ?? "creator-only";
    if (typeof preset === "object") {
        if (!Array.isArray(preset.allowlist) || preset.allowlist.length === 0) {
            throw new Error("consensus.access.allowlist must list at least one identity CID");
        }
        const normalized = preset.allowlist.map((entry) => {
            try {
                return CID.parse(entry).toString();
            } catch {
                throw new Error(`consensus.access.allowlist entry is not an identity CID: ${entry}`);
            }
        });
        return { allowlist: [...new Set(normalized)] };
    }
    if (!["creator-only", "public", "prefix-per-writer", "namespace-per-writer"].includes(preset)) {
        throw new Error(`Unknown access preset: ${String(preset)}`);
    }
    return preset;
}

/**
 * Compiles an access preset to the json-logic access policy stored in the
 * manifest. Inputs available to the rule: entryCreator, databaseCreator,
 * entryKey — all taken from the signed entry / manifest, never node-local
 * (D1/D3), so every replica reaches the same verdict.
 *
 * @param access - The validated preset.
 * @returns The policy data to sign into the manifest.
 */
function accessPolicyRule(access: AccessPreset): PolicyDefinition {
    if (access === "public") {
        return { version: 1, name: "denkmit-access-public", description: "Any identity may write", logic: true };
    }
    if (access === "prefix-per-writer") {
        return {
            version: 1,
            name: "denkmit-access-prefix-per-writer",
            description: "Creator writes anywhere; others only under agents/<their-cid>/",
            logic: {
                or: [
                    { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
                    { startsWith: [{ var: "entryKey" }, { cat: ["agents/", { var: "entryCreator" }, "/"] }] },
                ],
            } as unknown as RulesLogic,
        };
    }
    if (access === "namespace-per-writer") {
        return {
            version: 1,
            name: "denkmit-access-namespace-per-writer",
            description: "Every identity, the creator included, writes only under agents/<its-cid>/",
            logic: {
                startsWith: [{ var: "entryKey" }, { cat: ["agents/", { var: "entryCreator" }, "/"] }],
            } as unknown as RulesLogic,
        };
    }
    if (typeof access === "object") {
        return {
            version: 1,
            name: "denkmit-access-allowlist",
            description: "Only listed identities may write",
            logic: { in: [{ var: "entryCreator" }, access.allowlist] } as unknown as RulesLogic,
        };
    }
    return {
        version: 1,
        name: "denkmit-access-creator-only",
        description: "Only the database creator may write",
        logic: { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
    };
}

/**
 * The database implementation. Callers get it as a {@link Database}; the rest of
 * its surface (tree, sync, merge) is internal.
 * @typeParam T - The type of values stored in the database.
 */
export class DenkmitDatabase<T> implements Database<T> {
    readonly manifest: Manifest;
    readonly maxPollardLength: number;
    readonly layers: Pollard[][];
    readonly heliaController: HeliaController;
    /**
     * Value cache, keyed by **entry CID** (not by database key). An entry's value
     * never changes, so a cached value can never be stale, whatever order reads,
     * writes and merges interleave in, and one Keyv can safely be shared between
     * databases (KNOWN_ISSUES.md #30). Superseded values are deleted when a newer
     * record wins.
     */
    readonly cache: ValueCache<T>;
    private sortedItemsStore: SortedItemsStore;
    /** Signing controllers for identities other than the database's own (WriteOptions). */
    private readonly signers = new Map<string, HeliaController>();
    private readonly syncController: SyncController;
    private head?: Head;
    // Start key of the queued-but-not-yet-running tree rebuild, if any — the
    // coalescing state for createTaskUpdateLayers.
    private pendingRebuildFrom?: number;
    readonly consensus: Consensus<SignedPolicy>;
    // Whether this instance created its cache (vs. caller-supplied). Only an
    // owned store may be cleared on close (KNOWN_ISSUES.md D4).
    private readonly ownsCache: boolean;
    private log: Logger;

    constructor(mdb: DatabaseInit<T>) {
        this.manifest = mdb.manifest;
        this.layers = [];
        this.ownsCache = mdb.valueCache === undefined;
        this.cache = mdb.valueCache ?? new Keyv<T>();
        this.sortedItemsStore = new SortedItemsStore();
        this.maxPollardLength = mdb.manifest.subtreeLeaves;
        this.heliaController = mdb.heliaController;
        this.syncController = mdb.syncController;
        this.consensus = mdb.consensus;
        this.log = this.heliaController.helia.logger.forComponent("denkmitdb:denkmitdb");
    }

    /**
     * Evaluates the manifest-bound access (authorization) policy for a write.
     * Uses only deterministic inputs — the entry's signed creator and key vs. the
     * database creator — so every replica reaches the same decision.
     */
    private async isAuthorized(entryCreator: CID, entryKey: string, entryOperation: EntryOperation): Promise<boolean> {
        return evaluatePolicy(this.consensus.access, {
            entryCreator: entryCreator.toString(),
            databaseCreator: this.manifest.creator.toString(),
            entryKey,
            entryOperation,
        });
    }

    /**
     * Evaluates the manifest-bound validation (consensus) policy for a signed
     * entry. The input is a pure function of manifest + signed-entry data — no
     * wall clock, no local identity — so every replica reaches the same verdict
     * for the same entry (specs/ordering.md §4, KNOWN_ISSUES.md #25).
     */
    private async isValid(entry: { timestamp: number; creator: CID; key: string; deleted?: boolean }): Promise<boolean> {
        return evaluatePolicy(this.consensus.validity, {
            databaseCreator: this.manifest.creator.toString(),
            entryTimestamp: entry.timestamp,
            entryCreator: entry.creator.toString(),
            entryKey: entry.key,
            entryOperation: operationOf(entry),
        });
    }

    /**
     * Whether a signed entry belongs to this database. Current (v2) entries must
     * carry this database's address; legacy unbound v1 entries are accepted only
     * by legacy (v1-manifest) databases, so 3.0.0 data stays readable while new
     * databases are immune to cross-database replay (KNOWN_ISSUES.md #24).
     */
    private isBoundHere(entry: Entry<unknown>): boolean {
        if (entry.version === ENTRY_VERSION) return entry.manifest?.equals(this.manifest.cid) === true;
        return entry.version === LEGACY_ENTRY_VERSION && this.manifest.version === LEGACY_MANIFEST_VERSION;
    }

    get identity(): SigningIdentity {
        return this.heliaController.identity;
    }

    /**
     * Gets the pollard order in the database.
     * @returns The pollard order.
     */
    get order(): number {
        return Math.log2(this.manifest.subtreeLeaves);
    }

    /**
     * Sets the value of a key in the database.
     *
     * @param key - The key to set.
     * @param value - The value to set for the key.
     * @param options - Optional signer override (see {@link WriteOptions}).
     * @returns A promise that resolves when the operation is complete.
     */
    async set(key: string, value: T, options: WriteOptions = {}): Promise<void> {
        const signer = this.signerFor(options.identity);
        // Authorization first: createEntry signs, stores, and pins a block, so an
        // unauthorized writer must be rejected before anything is persisted —
        // otherwise every denied write still grows the local store.
        if (!(await this.isAuthorized(signer.identity.cid, key, "put"))) {
            throw new Error(`Access denied: this identity may not write key "${key}" in this database`);
        }

        const entry = await createEntry<T>(key, value, signer, this.manifest.cid);
        if (!(await this.isValid(entry))) throw new Error("Consensus failed");

        const result = await this.sortedItemsStore.set(entry.timestamp, key, entry.cid, entry.creator);
        // A concurrently-known entry with a greater composite key already wins.
        if (!result.applied) return;

        await this.cache.set(entry.cid.toString(), value);
        await this.forgetCached(result.previousCid);
        const rebuildFrom = Math.min(entry.timestamp, result.previousTimestamp ?? entry.timestamp);
        await this.createTaskUpdateLayers(rebuildFrom);
    }

    /**
     * Deletes a key by writing a signed tombstone (specs/ordering.md): the tombstone
     * participates in the same composite last-write-wins order as puts, hides the
     * key from `get`/`iterator` while it wins, and a newer `set` resurrects the key.
     * The record remains in the Merkle tree and replicates like any entry; no block
     * garbage collection is performed.
     *
     * @param key - The key to delete.
     * @param options - Optional signer override (see {@link WriteOptions}).
     * @returns A promise that resolves when the tombstone is indexed.
     */
    async delete(key: string, options: WriteOptions = {}): Promise<void> {
        const signer = this.signerFor(options.identity);
        // Authorization before the tombstone is signed/stored/pinned (see set()).
        if (!(await this.isAuthorized(signer.identity.cid, key, "delete"))) {
            throw new Error(`Access denied: this identity may not delete key "${key}" in this database`);
        }

        const entry = await createTombstone(key, signer, this.manifest.cid);
        if (!(await this.isValid(entry))) throw new Error("Consensus failed");

        const result = await this.sortedItemsStore.set(entry.timestamp, key, entry.cid, entry.creator, true);
        if (!result.applied) return;

        await this.forgetCached(result.previousCid);
        const rebuildFrom = Math.min(entry.timestamp, result.previousTimestamp ?? entry.timestamp);
        await this.createTaskUpdateLayers(rebuildFrom);
    }

    /**
     * The controller that signs a write: the database's own unless another identity
     * is given. One controller per identity is kept, so its identity cache is reused.
     */
    private signerFor(identity?: SigningIdentity): HeliaController {
        if (!identity || identity.cid.equals(this.identity.cid)) return this.heliaController;
        const key = identity.cid.toString();
        let signer = this.signers.get(key);
        if (!signer) {
            signer = new HeliaController(this.heliaController.helia, identity);
            this.signers.set(key, signer);
        }
        return signer;
    }

    /** Drops a superseded record's cached value (no-op for tombstones / no record). */
    private async forgetCached(cid: CID | undefined): Promise<void> {
        if (cid) await this.cache.delete(cid.toString());
    }

    /**
     * Retrieves the value associated with the specified key.
     * The index names the winning entry; its value comes from the cache (keyed by
     * entry CID) or is fetched, verified and cached.
     *
     * @param key - The key to retrieve the value for.
     * @returns The value associated with the key, or undefined if not found.
     */
    async get(key: string): Promise<T | undefined> {
        const item = this.sortedItemsStore.getRecord(key);
        if (!item || item.deleted) return; // absent, or hidden by a winning tombstone
        // Falsy values (0, "", false, null) are valid — distinguish them from a
        // cache miss with an explicit undefined check (KNOWN_ISSUES.md #18).
        const cacheKey = item.cid.toString();
        const cached = await this.cache.get(cacheKey);
        if (cached !== undefined) return cached;
        let entry;
        try {
            entry = await fetchEntry<T>(item.cid, this.heliaController);
        } catch {
            // The index references the entry but the block is missing or invalid
            // (not replicated yet, GC'd, unreachable peer). An unfetchable value
            // reads as absent rather than throwing — and, in entries(), rather
            // than aborting the whole iteration.
            this.log("get(%s): entry %s unfetchable", key, item.cid.toString());
            return;
        }
        if (!entry || entry.deleted || entry.value === undefined) return;
        // Caching under the entry CID is safe even if a newer record won while this
        // fetch was in flight: this value is still exactly that entry's value.
        await this.cache.set(cacheKey, entry.value);
        return entry.value;
    }

    /**
     * Returns the provenance of the current record for a key: the signed entry's
     * CID, its writer identity CID, the write timestamp, and whether it is a
     * tombstone. Undefined when the key has never been written.
     *
     * @param key - The key to inspect.
     * @returns The provenance record, or undefined if the key is unknown.
     */
    async provenance(key: string): Promise<Provenance | undefined> {
        // Served entirely from the index: creator/timestamp/deleted were taken from
        // the SIGNED entry when it was verified and indexed, so no refetch is needed
        // — and a missing block cannot make provenance throw.
        const item = await this.sortedItemsStore.getByKey(key);
        if (!item) return undefined;
        return { entryCid: item.cid, writer: item.creator, timestamp: item.timestamp, deleted: item.deleted === true };
    }

    /**
     * Returns an async iterator that yields key-value pairs from the DenkmitDB instance.
     * The key-value pairs are retrieved from the sortedItemsStore and filtered based on the availability of the value.
     * @returns An async generator that yields key-value pairs.
     */
    async *entries(): AsyncGenerator<[key: string, value: T]> {
        for await (const { key } of this.sortedItemsStore.iterator()) {
            const value = await this.get(key);
            if (value !== undefined) yield [key, value];
        }
    }

    /**
     * Iterates live keys in write-time order without fetching values: tombstoned
     * keys are skipped, everything else comes straight from the index. Listings
     * and prefix filters should use this instead of `entries()`, which fetches
     * (and caches) every value it passes.
     */
    async *keys(): AsyncGenerator<string> {
        for await (const { key, deleted } of this.sortedItemsStore.iterator()) {
            if (!deleted) yield key;
        }
    }

    /**
     * Closes the DenkmitDB instance.
     *
     * @returns A promise that resolves when the DenkmitDB instance is closed.
     */
    async close(): Promise<void> {
        // Stop sync first: it drops queued work (even on a paused caller-supplied
        // controller) and waits for a task that is already running, so nothing
        // below races a background rebuild or merge.
        await this.syncController.close();
        try {
            // Make acknowledged writes recoverable: run the rebuild that was still
            // queued (its task was just dropped), then build and persist a head for
            // it. Without this, close() discarded the pending rebuild and a write made
            // shortly before close was not discoverable on reopen (KNOWN_ISSUES.md
            // #28). Persisting only — nothing is announced while shutting down.
            const pending = this.pendingRebuildFrom;
            this.pendingRebuildFrom = undefined;
            if (pending !== undefined) await this.updateLayers(pending);
            await this.createOnlyNewHead();
        } catch (error) {
            // Typically the Helia node was stopped before the database: its stores are
            // gone, so there is nowhere left to persist to. Closing must still succeed.
            // Close the database before stopping Helia to keep the last writes durable.
            this.log.error("close: could not persist the head; recent writes may need a peer to recover", error);
        } finally {
            // Only clear a store we created; a caller-supplied (possibly persistent)
            // Keyv is theirs, and clearing it would destroy their data (D4).
            if (this.ownsCache) await this.cache.clear();
            this.layers.length = 0;
            this.sortedItemsStore.clear();
        }
    }


    /**
     * Gets the address of the denkmitdb.
     * @returns The CID (Content Identifier) of the denkmitdb.
     */
    get address(): CID {
        return this.manifest.cid;
    }

    getLayers(): Pollard[][] {
        return this.layers;
    }

    async getCID(): Promise<CID> {
        const lastLayer = this.layers.at(-1);
        if (!lastLayer) throw new Error("No layers");
        return await lastLayer[0].getCID();
    }

    async createOnlyNewHead(): Promise<Head | undefined> {
        if (this.recordCount === 0) return undefined;
        const root = await this.getCID();

        if (this.head && this.head.root.equals(root)) return undefined;

        const headInput: HeadPayload = {
            version: HEAD_VERSION,
            manifest: this.manifest.cid,
            root,
            timestamp: Date.now(),
            layers: this.layers.length,
            size: this.recordCount,
        };

        this.head = await createHead(headInput, this.heliaController);

        // Persist the pointer only after the head (and the tree it references) is
        // complete, so a crash mid-build never leaves a dangling pointer (D4).
        await this.heliaController.datastore.put(headStoreKey(this.manifest.cid), this.head.cid.bytes);

        return this.head;
    }

    async createHead(): Promise<Head> {
        const head = (await this.createOnlyNewHead()) ?? this.head;
        if (!head) throw new Error("Cannot create head: database is empty");
        return head;
    }

    async fetchHead(cid: CID): Promise<Head> {
        return await fetchHead(cid, this.heliaController);
    }

    get recordCount(): number {
        return this.sortedItemsStore.size;
    }

    async compare(head: Head): Promise<{ isEqual: boolean; difference: [Leaf[], Leaf[]] }> {
        const layersCount = Math.max(this.layers.length, head.layers);
        const budget = new TreeWalkBudget(this.maxPollardsFor(head));

        const difference = await this.compareNodes(
            head.layers,
            head.root,
            { layerIndex: layersCount - 1, position: 0 },
            budget,
        );

        difference[0] = difference[0].filter((x) => x.type !== LeafKind.Empty);
        difference[1] = difference[1].filter((x) => x.type !== LeafKind.Empty);

        const isEqual = difference[0].length === 0 && difference[1].length === 0;

        return { isEqual, difference };
    }

    /**
     * Merges the provided `head` with the current state of the database.
     * If the `head` is equal to the current state, no merge is performed.
     * Otherwise, the method compares the `head` with the current state,
     * extracts the smallest timestamp from the differing sorted entries,
     * and creates a task to update the layers based on the smallest timestamp.
     *
     * @param head - The head to be merged with the current state of the database.
     * @returns A promise that resolves when the merge operation is completed.
     */
    async merge(head: Head): Promise<void> {
        const { isEqual, difference } = await this.compare(head);
        if (isEqual) return;

        let rebuildFrom = Number.MAX_SAFE_INTEGER;
        let mergedAny = false;

        for (const leaf of difference[1]) {
            if (leaf.type !== LeafKind.SortedEntry) continue;
            const timestamp = await this.processLeafMerging(leaf);
            if (timestamp === undefined) continue; // unverifiable, forged, or lost the conflict
            mergedAny = true;
            if (timestamp < rebuildFrom) rebuildFrom = timestamp;
        }

        // Nothing to apply — don't schedule a rebuild against a bogus timestamp
        // (KNOWN_ISSUES.md #5).
        if (mergedAny) await this.createTaskUpdateLayers(rebuildFrom);
    }

    /**
     * Diffs the local subtree at `{layerIndex, position}` against the remote
     * subtree rooted at `remote` (undefined when the remote tree has nothing
     * there). `remoteLayers` is the remote tree's height: at and above that layer
     * the remote tree is virtual — its root is the leftmost descendant — so a peer
     * with fewer layers is still compared at the right depth (KNOWN_ISSUES.md #26).
     */
    private async compareNodes(
        remoteLayers: number,
        remote: CID | undefined,
        { layerIndex, position }: PollardLocation,
        budget: TreeWalkBudget,
    ): Promise<[Leaf[], Leaf[]]> {
        const result: [Leaf[], Leaf[]] = [[], []];
        const thisPollard = this.getPollardTreeNode({ layerIndex, position }).pollard;
        const append = (next: [Leaf[], Leaf[]]) => {
            for (const leaf of next[0]) result[0].push(leaf);
            for (const leaf of next[1]) result[1].push(leaf);
        };
        const descend = (i: number, child: CID | undefined) =>
            this.compareNodes(remoteLayers, child, { layerIndex: layerIndex - 1, position: position * this.maxPollardLength + i }, budget);

        if (layerIndex >= remoteLayers) {
            // Above the remote root: only the leftmost child carries the remote tree.
            const width = Math.max(thisPollard?.length ?? 0, remote ? 1 : 0);
            for (let i = 0; i < width; i++) append(await descend(i, i === 0 ? remote : undefined));
            return result;
        }

        const otherPollard = remote ? await this.getRemotePollard(remote, budget) : undefined;
        if (!thisPollard && !otherPollard) return result;

        const comp = await (thisPollard ?? (await createEmptyPollard(this.order))).compare(otherPollard);
        if (comp.isEqual) return result;

        if (layerIndex === 0) {
            append(comp.difference);
            return result;
        }

        // Child positions use the fixed fan-out, not the (possibly partial) length
        // of this pollard, or right-edge subtrees are compared against the wrong
        // local nodes.
        const width = Math.max(thisPollard?.length ?? 0, otherPollard?.length ?? 0);
        for (let i = 0; i < width; i++) {
            const leaf = otherPollard && i < otherPollard.length ? otherPollard.getLeaf(i) : undefined;
            append(await descend(i, leaf?.type === LeafKind.Pollard ? leaf.link : undefined));
        }

        return result;
    }

    /** Pollard budget for walking a head's tree: what an honest tree of its size needs. */
    private maxPollardsFor(head: Head): number {
        return 2 * Math.ceil(head.size / this.maxPollardLength) + head.layers + 1;
    }

    /**
     * Fetches a pollard from a peer's tree under the walk budget, rejecting
     * shapes no honest replica of this database builds: another order, or a
     * length/width beyond the fan-out (the loop bounds come from these fields).
     */
    private async getRemotePollard(cid: CID, budget: TreeWalkBudget): Promise<Pollard | undefined> {
        budget.visit(cid);
        const pollard = await this.getPollard(cid);
        if (!pollard) return undefined;
        const width = pollard.layers[0]?.length ?? 0;
        if (
            pollard.order !== this.order ||
            !Number.isSafeInteger(pollard.length) ||
            pollard.length < 0 ||
            pollard.length > this.maxPollardLength ||
            width > this.maxPollardLength
        ) {
            throw new TreeRejectedError(`pollard ${cid.toString()} does not match this database's tree shape`);
        }
        return pollard;
    }

    /**
     * Whether a fetched head is plausible for this database before any of its tree
     * is walked: an integer layer count within what 2^40 entries need, and a size
     * that fits those layers (KNOWN_ISSUES.md #26).
     */
    private isPlausibleHead(head: Head): boolean {
        const { layers, size } = head;
        if (!Number.isSafeInteger(layers) || layers < 1 || layers > maxHeadLayers(this.order)) return false;
        if (!Number.isSafeInteger(size) || size < 1) return false;
        return size <= this.maxPollardLength ** layers && CID.asCID(head.root) !== null;
    }

    /**
     * Ingests one `SortedEntry` leaf from a peer's tree. The leaf's metadata is
     * untrusted (pollards are unsigned): the entry block is fetched and its
     * signature verified, and indexing uses the SIGNED key/timestamp/creator —
     * never the leaf's claims (KNOWN_ISSUES.md #10). Returns the timestamp to
     * rebuild the tree from if this entry became the live record for its key, or
     * `undefined` if it was unverifiable, rejected by consensus, or lost the
     * last-write-wins conflict.
     */
    private async processLeafMerging(leaf: Leaf): Promise<number | undefined> {
        if (leaf.type !== LeafKind.SortedEntry) return;
        const cid = leaf.link;

        let entry;
        try {
            // fetchEntry verifies the JWS signature and the payload shape; throws if
            // missing, invalid, or malformed.
            entry = await fetchEntry(cid, this.heliaController);
        } catch {
            this.log("Rejected leaf %s: entry missing, malformed, or signature invalid", cid.toString());
            return;
        }

        // The signed entry must belong to THIS database — otherwise any entry (or
        // tombstone) written to another database by a shared writer could be
        // replayed here inside a head we accept (KNOWN_ISSUES.md #24).
        if (!this.isBoundHere(entry)) {
            this.log("Rejected leaf %s: entry is not bound to this database", cid.toString());
            return;
        }

        const timestamp = entry.timestamp;
        const key = entry.key;
        const creator = entry.creator;

        // Authorization on the merge/load path — the signed creator must be allowed
        // to write, or a peer could inject entries the local writer couldn't
        // (KNOWN_ISSUES.md D1). Deterministic, so replicas agree on what they ingest.
        if (!(await this.isAuthorized(creator, key, operationOf(entry)))) {
            this.log("Rejected leaf %s: writer %s not authorized", cid.toString(), creator.toString());
            return;
        }

        if (!(await this.isValid(entry))) {
            this.log("Rejected leaf %s: consensus check failed", cid.toString());
            return;
        }

        // Losers are dropped before any work is done for them.
        if (!this.sortedItemsStore.wouldApply(timestamp, key, cid)) return;

        // Pin the foreign entry BEFORE indexing it: it was fetched unpinned, and the
        // tree we rebuild will reference it, so it must survive GC and restarts
        // (D4). Pinning can fail (deadline, storage); indexing first left the entry
        // live but unpinned, and every later sync saw it as already applied and
        // never retried (KNOWN_ISSUES.md #31). Now a failed pin leaves nothing
        // behind, and the next announcement of the head retries the entry. (A
        // concurrent winner can still beat it to the index below — then the pin is
        // merely redundant, never missing.)
        try {
            await this.heliaController.pin(cid);
        } catch (error) {
            this.log("Deferred leaf %s: pin failed (%s); retried on the next sync", cid.toString(), String(error));
            return;
        }

        const result = await this.sortedItemsStore.set(timestamp, key, cid, creator, entry.deleted === true);
        if (!result.applied) return;

        // The superseded record's value can never be read again (#30).
        await this.forgetCached(result.previousCid);
        return Math.min(timestamp, result.previousTimestamp ?? timestamp);
    }

    /**
     * Schedules a tree rebuild from `sortKey`, coalescing with any rebuild already
     * queued: while one is pending, later requests only lower its start key instead
     * of enqueueing another full rebuild. A burst of N writes costs one rebuild
     * from the earliest change, not N rebuilds — without this, sequential write
     * throughput collapses (measured ~7 ops/s at 1k entries, scripts/bench.mjs).
     */
    async createTaskUpdateLayers(sortKey: number): Promise<void> {
        if (this.pendingRebuildFrom !== undefined) {
            this.pendingRebuildFrom = Math.min(this.pendingRebuildFrom, sortKey);
            return;
        }
        this.pendingRebuildFrom = sortKey;
        this.syncController.addTask(async () => {
            const from = this.pendingRebuildFrom ?? sortKey;
            // Reset before running: writes landing while the rebuild runs must
            // schedule a fresh task (they are not covered by this pass).
            this.pendingRebuildFrom = undefined;
            await this.updateLayers(from);
        });
    }

    async updateLayers(sortKey: number): Promise<void> {
        // An empty index has no tree; drop any stale layers and stop.
        if (this.sortedItemsStore.size === 0) {
            this.layers.length = 0;
            return;
        }

        let index = 0;
        if (sortKey > 0) {
            const it = await this.sortedItemsStore.find(sortKey);
            index = it.index;
        }
        // Rebuild from the start of the pollard containing the earliest change, so
        // position bookkeeping stays aligned to pollard boundaries.
        const startIndex = Math.floor(index / this.maxPollardLength) * this.maxPollardLength;
        const startPosition = this.calculatePositionInLayer(startIndex);

        let pollard = await createEmptyPollard(this.order);
        let layerIndex = 0;

        let position = startPosition;

        for await (const item of this.sortedItemsStore.iteratorFromIndex(startIndex)) {
            const { cid, key, creator } = item;
            ({ pollard, position } = await this.handlePollardCreation(pollard, layerIndex, position));
            await pollard.append(LeafKind.SortedEntry, cid, creator, [item.timestamp], key);
        }

        await this.handlePollardUpdate(pollard, layerIndex, position);

        for (layerIndex++; this.layers[layerIndex - 1].length > 1; layerIndex++) {
            // A fresh accumulator per layer. Carrying one across layers aliases the
            // partially-filled pollard already stored at layers[layerIndex - 1], so the
            // layer above appends into it — including its own CID — producing a
            // self-referential block that pinning never finishes walking.
            pollard = await createEmptyPollard(this.order);
            if (this.layers.length === layerIndex) this.layers.push([]);
            position = this.calculatePositionInLayer(startPosition, layerIndex);
            const startIndexInLowerLayer = position * this.maxPollardLength;
            const slicedLayer = this.layers[layerIndex - 1].slice(startIndexInLowerLayer);
            for (const pollardNode of slicedLayer) {
                ({ pollard, position } = await this.handlePollardCreation(pollard, layerIndex, position));
                await pollard.append(LeafKind.Pollard, await pollardNode.getCID());
            }
            await this.handlePollardUpdate(pollard, layerIndex, position);
        }
    }

    private calculatePositionInLayer(entryPosition: number, layerIndex: number = 1): number {
        return Math.floor(entryPosition / this.maxPollardLength ** layerIndex);
    }

    private async handlePollardCreation(pollard: Pollard, layerIndex: number, position: number) {
        if (!pollard.isFree()) {
            await this.handlePollardUpdate(pollard, layerIndex, position);
            pollard = await createEmptyPollard(this.order);
            position++;
        }
        return { pollard, position };
    }

    private async handlePollardUpdate(pollard: Pollard, layerIndex: number, position: number) {
        await pollard.updateLayers();
        // Stored unpinned: pinning every rebuilt pollard walks the whole DAG below
        // it on every write (O(database) per write). The signed head pins the root
        // pollard recursively, covering the entire current tree (see
        // HeliaStorage.put / createOnlyNewHead).
        await this.heliaController.put(pollard.toJSON());
        this.setPollardTreeNode({ layerIndex, position, pollard });
    }

    setPollardTreeNode(node: PollardNode): void {
        const { layerIndex, position, pollard } = node;
        if (this.layers.length <= layerIndex) {
            this.layers.push([]);
        }
        if (pollard) this.layers[layerIndex][position] = pollard;
    }

    getPollardTreeNode({ layerIndex, position }: PollardLocation): PollardNode {
        if (this.layers.length <= layerIndex || this.layers[layerIndex].length <= position) {
            return { layerIndex, position, pollard: undefined };
        }
        return {
            layerIndex,
            position,
            pollard: this.layers[layerIndex][position],
        };
    }

    /**
     * Loads the data from the given head into the database.
     * @param head - The head interface containing the root bytes.
     * @returns A promise that resolves when the loading is complete.
     */
    async load(head: Head): Promise<void> {
        // load() fully replaces local state with the authenticated contents of the
        // remote tree (KNOWN_ISSUES.md #17). The remote pollards are only walked to
        // discover entries; the honest tree is rebuilt from the verified index, so
        // forged leaf structure/metadata cannot survive.
        //
        // Phase 1 walks the remote tree level by level under the walk budget and the
        // head's own layer count (KNOWN_ISSUES.md #26): a repeated or misshapen
        // pollard rejects the head before any local state is touched.
        const budget = new TreeWalkBudget(this.maxPollardsFor(head));
        const leaves: Leaf[] = [];
        let links: CID[] = [head.root];
        for (let level = 0; links.length > 0; level++) {
            if (level >= head.layers) throw new TreeRejectedError("tree is deeper than the head claims");
            const pollards = await Promise.all(links.map((link) => this.getRemotePollard(link, budget)));
            const next: CID[] = [];
            for (const pollard of pollards) {
                if (!pollard) continue; // missing or wrong version — skip
                for (const leaf of pollard.iterator()) {
                    if (leaf.type === LeafKind.Pollard) next.push(leaf.link);
                    else if (leaf.type === LeafKind.SortedEntry) leaves.push(leaf);
                }
            }
            links = next;
        }

        // Phase 2 replaces local state with the verified entries.
        this.layers.length = 0;
        // Invalidate the value cache. An owned store is cleared outright; a
        // caller-supplied (possibly shared/persistent) Keyv only has the keys THIS
        // database indexed deleted from it — clear() would destroy whatever else
        // the caller keeps there (same ownership rule as close(), D4).
        if (this.ownsCache) {
            await this.cache.clear();
        } else {
            for await (const { cid } of this.sortedItemsStore.iterator()) {
                await this.cache.delete(cid.toString());
            }
        }
        await this.sortedItemsStore.clear();
        this.head = undefined;

        // Entry verifications run with bounded concurrency: the work items are
        // independent — processLeafMerging verifies and LWW-indexes one signed
        // entry, which is order-insensitive by construction — and the bulk-load
        // path is fetch-latency-bound, so sequential awaits made full replication
        // scale with round-trips × entries (scripts/bench.mjs). An unbounded
        // Promise.all over 10k+ entries floods bitswap/pinning instead.
        const BATCH = 64;
        for (let i = 0; i < leaves.length; i += BATCH) {
            await Promise.all(leaves.slice(i, i + BATCH).map((leaf) => this.processLeafMerging(leaf)));
        }
        await this.createTaskUpdateLayers(0);
    }

    private async getPollard(cid: CID): Promise<Pollard | undefined> {
        const pollardInput = await this.heliaController.get<PollardType>(cid);
        if (!pollardInput) return;
        if (pollardInput.version !== POLLARD_VERSION) {
            this.log("Rejected pollard %s: version %d", cid.toString(), pollardInput.version);
            return;
        }
        return await createPollard(pollardInput, { cid, noUpdate: true });
    }

    async syncNewHead(data: Uint8Array): Promise<void> {
        const cid = CID.decode(data);
        this.log("syncNewHead %s", cid.toString());
        await this.syncController.addTask(async () => {
            let head: Head;
            try {
                head = await this.fetchHead(cid);
            } catch {
                this.log("Rejected head %s: not found or signature invalid", cid.toString());
                return;
            }

            // Only ingest heads that belong to THIS database and speak our format
            // version (KNOWN_ISSUES.md #11, specs/ordering.md §5).
            if (!head.manifest.equals(this.manifest.cid)) {
                this.log("Rejected head %s: foreign manifest %s", cid.toString(), head.manifest.toString());
                return;
            }
            if (head.version !== HEAD_VERSION) {
                this.log("Rejected head %s: unsupported version %d", cid.toString(), head.version);
                return;
            }
            if (!this.isPlausibleHead(head)) {
                this.log("Rejected head %s: implausible layers/size", cid.toString());
                return;
            }

            try {
                if (this.recordCount === 0) {
                    await this.load(head);
                } else {
                    await this.merge(head);
                }
            } catch (error) {
                if (!(error instanceof TreeRejectedError)) throw error;
                this.log("Rejected head %s: %s", cid.toString(), error.message);
            }
        });
    }

    async sendHead(): Promise<void> {
        const head = await this.createOnlyNewHead();
        if (head) await this.syncController.sendHead(head);
    }

    /**
     * Re-announces the current head on the sync topic even when the root has not
     * changed. `sendHead()` only publishes on a root change, so a peer that connects
     * after the last change-triggered announcement would otherwise never learn the
     * head (KNOWN_ISSUES.md #21). Builds a head first if one exists but hasn't been
     * created yet; no-op for an empty database.
     *
     * @returns A promise that resolves once the head (if any) has been published.
     */
    async announceHead(): Promise<void> {
        const head = (await this.createOnlyNewHead()) ?? this.head;
        if (head) await this.syncController.sendHead(head);
    }

    /**
     * Resolves once queued background work (tree rebuilds, merges) has drained.
     * Writes are indexed synchronously, but the Merkle tree is rebuilt on the sync
     * queue; await this to observe a settled tree/head after `set` or a merge.
     */
    async waitUntilIdle(): Promise<void> {
        await this.syncController.onIdle();
    }

    /**
     * Sets up the synchronization process.
     *
     * @returns A Promise that resolves when the setup is complete.
     */
    async setupSync(): Promise<void> {
        this.log("Setup sync");
        await this.syncController.start(async (data: Uint8Array) => await this.syncNewHead(data));
        // Re-announce the current head periodically (not only on change) so late
        // joiners and newly-connected peers can converge (KNOWN_ISSUES.md #21).
        await this.syncController.addRepetitiveTask(async () => {
            await this.announceHead();
        }, 30000);
    }
}
