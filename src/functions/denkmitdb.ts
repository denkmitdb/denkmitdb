import type { Logger } from "@libp2p/interface";
import { Key } from "interface-datastore";
import Keyv from "keyv";
import { CID } from "multiformats/cid";
import { createEmptyPollard, createEntry, createPollard, createTombstone, fetchEntry } from "./index.js";
import {
    ConsensusControllerInterface,
    ConsensusData,
    DENKMITDB_PREFIX,
    DenkmitDatabaseInput,
    DenkmitDatabaseInterface,
    DenkmitDatabaseOptions,
    HEAD_VERSION,
    HeadData,
    HeadInterface,
    HeliaControllerInterface,
    IdentityInterface,
    LeafType,
    LeafTypes,
    MANIFEST_VERSION,
    ManifestData,
    ManifestInterface,
    POLLARD_VERSION,
    PollardInterface,
    PollardLocation,
    PollardNode,
    PollardType,
    SyncControllerInterface,
} from "../types/index.js";

import { createConsensus, fetchConsensus } from "./consensus.js";
import { createHead, fetchHead } from "./head.js";
import { createManifest, fetchManifest } from "./manifest.js";
import { createSyncController } from "./sync.js";
import { HeliaController } from "./utils/helia.js";
import { SortedItemsStore } from "./utils/sortedItems.js";

// class TimestampConsensusController {} // TODO: Implement TimestampConsensusController

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
 * Creates a Denkmit database with the specified name and options.
 *
 * @param name - The name of the database.
 * @param options - The options for configuring the database.
 * @returns A promise that resolves to the created DenkmitDatabaseInterface.
 * @typeParam T - The type of data stored in the database.
 */
export async function createDenkmitDatabase<T>(
    name: string,
    options: DenkmitDatabaseOptions<T>,
): Promise<DenkmitDatabaseInterface<T>> {
    const identity = options.identity;
    const heliaController = new HeliaController(options.helia, identity);

    const consensus: ConsensusData = {
        version: 1,
        name: "denkmit-timestamp",
        description: "Consensus for denkmit database timestamp",
        logic: true,
    };

    const consensusController = await createConsensus(consensus, heliaController);

    // Access (authorization) policy — separate from consensus (validation). Default
    // is creator-only; opt into world-writable with `publicWrite`. The rule uses only
    // deterministic inputs (the signed entry's creator vs. the manifest creator), so
    // every replica reaches the same decision (KNOWN_ISSUES.md D1, specs/ordering.md).
    const accessController = await createConsensus(accessPolicy(options.publicWrite ?? false), heliaController);

    const manifestInput: ManifestData = {
        version: MANIFEST_VERSION,
        name,
        type: "denkmit-database-key-value",
        order: 3,
        consensus: consensusController.cid,
        access: accessController.cid,
        timestamp: Date.now(),
    };
    const manifest = await createManifest(manifestInput, heliaController);
    const syncController =
        options.syncController ?? (await createSyncController(syncTopic(manifest.cid), heliaController));

    const mdb: DenkmitDatabaseInput<T> = {
        manifest,
        heliaController,
        identity,
        keyValueStorage: options.keyValueStorage,
        syncController,
        consensusController,
        accessController,
    };
    const dmdb = new DenkmitDatabase<T>(mdb);
    await dmdb.setupSync();

    return dmdb;
}

/**
 * Opens a Denkmit database.
 *
 * @param cid - The CID (Content Identifier) of the database.
 * @param options - The options for opening the database.
 * @returns A promise that resolves to a DenkmitDatabaseInterface instance.
 * @typeParam T - The type of data stored in the database.
 */
export async function openDenkmitDatabase<T>(
    cid: CID,
    options: DenkmitDatabaseOptions<T>,
): Promise<DenkmitDatabaseInterface<T>> {
    const identity = options.identity;
    const heliaController = new HeliaController(options.helia, identity);
    const manifest = await fetchManifest(cid, heliaController);
    const syncController = options.syncController ?? (await createSyncController(syncTopic(manifest.cid), heliaController));
    const consensusController = await fetchConsensus(manifest.consensus, heliaController);
    // The access policy is part of the database identity — always read it from the
    // signed manifest, never from local options (a local override would let replicas
    // disagree on who may write, breaking convergence — KNOWN_ISSUES.md #19).
    const accessController = await fetchConsensus(manifest.access, heliaController);

    const mdb: DenkmitDatabaseInput<T> = {
        manifest,
        heliaController,
        identity,
        keyValueStorage: options.keyValueStorage,
        syncController,
        consensusController,
        accessController,
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

/**
 * Builds the access-policy rule for a new database.
 * @param publicWrite - When true, any identity may write; otherwise creator-only.
 * @returns The consensus/access data describing the policy.
 */
function accessPolicy(publicWrite: boolean): ConsensusData {
    if (publicWrite) {
        return {
            version: 1,
            name: "denkmit-access-public",
            description: "Any identity may write",
            logic: true,
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
 * Represents a Denkmit Database.
 * @typeParam T - The type of values stored in the database.
 */
export class DenkmitDatabase<T> implements DenkmitDatabaseInterface<T> {
    readonly manifest: ManifestInterface;
    readonly maxPollardLength: number;
    readonly layers: PollardInterface[][];
    readonly heliaController: HeliaControllerInterface;
    readonly keyValueStorage: Keyv<T>;
    private sortedItemsStore: SortedItemsStore;
    private readonly syncController: SyncControllerInterface;
    private head?: HeadInterface;
    private consensusController: ConsensusControllerInterface;
    private accessController: ConsensusControllerInterface;
    // Whether this instance created keyValueStorage (vs. caller-supplied). Only an
    // owned store may be cleared on close (KNOWN_ISSUES.md D4).
    private readonly ownsKeyValueStorage: boolean;
    private log: Logger;

    constructor(mdb: DenkmitDatabaseInput<T>) {
        this.manifest = mdb.manifest;
        this.layers = [];
        this.ownsKeyValueStorage = mdb.keyValueStorage === undefined;
        this.keyValueStorage = mdb.keyValueStorage ?? new Keyv<T>();
        this.sortedItemsStore = new SortedItemsStore();
        this.maxPollardLength = 2 ** mdb.manifest.order;
        this.heliaController = mdb.heliaController;
        this.syncController = mdb.syncController;
        this.consensusController = mdb.consensusController;
        this.accessController = mdb.accessController;
        this.log = this.heliaController.helia.logger.forComponent("denkmitdb:denkmitdb");
    }

    /**
     * Evaluates the manifest-bound access (authorization) policy for a writer.
     * Uses only deterministic inputs — the entry's signed creator vs. the database
     * creator — so every replica reaches the same decision.
     */
    private async isAuthorized(entryCreator: CID): Promise<boolean> {
        return this.accessController.execute({
            entryCreator: entryCreator.toString(),
            databaseCreator: this.manifest.creator.toString(),
        });
    }

    get identity(): IdentityInterface {
        return this.heliaController.identity;
    }

    /**
     * Gets the pollard order in the database.
     * @returns The pollard order.
     */
    get order(): number {
        return this.manifest.order;
    }

    /**
     * Sets the value of a key in the database.
     *
     * @param key - The key to set.
     * @param value - The value to set for the key.
     * @returns A promise that resolves when the operation is complete.
     */
    async set(key: string, value: T): Promise<void> {
        const entry = await createEntry<T>(key, value, this.heliaController);

        // Authorization: is this writer allowed to write to this database?
        if (!(await this.isAuthorized(entry.creator))) {
            throw new Error("Access denied: this identity is not authorized to write to this database");
        }

        const check = {
            currentTimestamp: Date.now(),
            databaseCreator: this.manifest.creator.toString(),
            currentIdentity: this.identity.cid.toString(),
            entryTimestamp: entry.timestamp,
            entryCreator: entry.creator.toString(),
        };
        if (!(await this.consensusController.execute(check))) throw new Error("Consensus failed");

        const result = await this.sortedItemsStore.set(entry.timestamp, key, entry.cid, entry.creator);
        // A concurrently-known entry with a greater composite key already wins.
        if (!result.applied) return;

        await this.keyValueStorage.set(key, value);
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
     * @returns A promise that resolves when the tombstone is indexed.
     */
    async delete(key: string): Promise<void> {
        const entry = await createTombstone<T>(key, this.heliaController);

        if (!(await this.isAuthorized(entry.creator))) {
            throw new Error("Access denied: this identity is not authorized to write to this database");
        }

        const check = {
            currentTimestamp: Date.now(),
            databaseCreator: this.manifest.creator.toString(),
            currentIdentity: this.identity.cid.toString(),
            entryTimestamp: entry.timestamp,
            entryCreator: entry.creator.toString(),
        };
        if (!(await this.consensusController.execute(check))) throw new Error("Consensus failed");

        const result = await this.sortedItemsStore.set(entry.timestamp, key, entry.cid, entry.creator, true);
        if (!result.applied) return;

        await this.keyValueStorage.delete(key);
        const rebuildFrom = Math.min(entry.timestamp, result.previousTimestamp ?? entry.timestamp);
        await this.createTaskUpdateLayers(rebuildFrom);
    }

    /**
     * Retrieves the value associated with the specified key.
     * If the value is found in the key-value storage, it is returned.
     * Otherwise, it retrieves the item from the sorted items store,
     * fetches the entry using the CID, and stores the entry in the key-value storage.
     * Finally, it returns the retrieved value.
     *
     * @param key - The key to retrieve the value for.
     * @returns The value associated with the key, or undefined if not found.
     */
    async get(key: string): Promise<T | undefined> {
        // Falsy values (0, "", false, null) are valid — distinguish them from a
        // cache miss with an explicit undefined check (KNOWN_ISSUES.md #18).
        const value = await this.keyValueStorage.get(key);
        if (value !== undefined) return value;
        const item = await this.sortedItemsStore.getByKey(key);
        if (!item || item.deleted) return; // absent, or hidden by a winning tombstone
        const entry = await fetchEntry<T>(item.cid, this.heliaController);
        if (!entry || entry.deleted || entry.value === undefined) return;
        await this.keyValueStorage.set(key, entry.value);
        return entry.value;
    }

    /**
     * Returns an async iterator that yields key-value pairs from the DenkmitDB instance.
     * The key-value pairs are retrieved from the sortedItemsStore and filtered based on the availability of the value.
     * @returns An async generator that yields key-value pairs.
     */
    async *iterator(): AsyncGenerator<[key: string, value: T]> {
        for await (const { key } of this.sortedItemsStore.iterator()) {
            const value = await this.get(key);
            if (value !== undefined) yield [key, value];
        }
    }

    /**
     * Closes the DenkmitDB instance.
     *
     * @returns A promise that resolves when the DenkmitDB instance is closed.
     */
    async close(): Promise<void> {
        await this.syncController.close();
        // Only clear a store we created; a caller-supplied (possibly persistent)
        // Keyv is theirs, and clearing it would destroy their data (D4).
        if (this.ownsKeyValueStorage) await this.keyValueStorage.clear();
        this.layers.length = 0;
        this.sortedItemsStore.clear();
    }

    async getManifest(): Promise<ManifestInterface> {
        return this.manifest;
    }

    /**
     * Gets the address of the denkmitdb.
     * @returns The CID (Content Identifier) of the denkmitdb.
     */
    get address(): CID {
        return this.manifest.cid;
    }

    getLayers(): PollardInterface[][] {
        return this.layers;
    }

    async getCID(): Promise<CID> {
        const lastLayer = this.layers.at(-1);
        if (!lastLayer) throw new Error("No layers");
        return await lastLayer[0].getCID();
    }

    async createOnlyNewHead(): Promise<HeadInterface | undefined> {
        if (this.size === 0) return undefined;
        const root = await this.getCID();

        if (this.head && this.head.root.equals(root)) return undefined;

        const headInput: HeadData = {
            version: HEAD_VERSION,
            manifest: this.manifest.cid,
            root,
            timestamp: Date.now(),
            layers: this.layers.length,
            size: this.size,
        };

        this.head = await createHead(headInput, this.heliaController);

        // Persist the pointer only after the head (and the tree it references) is
        // complete, so a crash mid-build never leaves a dangling pointer (D4).
        await this.heliaController.datastore.put(headStoreKey(this.manifest.cid), this.head.cid.bytes);

        return this.head;
    }

    async createHead(): Promise<HeadInterface> {
        const head = (await this.createOnlyNewHead()) ?? this.head;
        if (!head) throw new Error("Cannot create head: database is empty");
        return head;
    }

    async fetchHead(cid: CID): Promise<HeadInterface> {
        return await fetchHead(cid, this.heliaController);
    }

    get size(): number {
        return this.sortedItemsStore.size;
    }

    async compare(head: HeadInterface): Promise<{ isEqual: boolean; difference: [LeafType[], LeafType[]] }> {
        const layersCount = Math.max(this.layers.length, head.layers);
        const order = layersCount - 1;

        const difference = await this.compareNodes(layersCount, head.root, { layerIndex: order, position: 0 });

        difference[0] = difference[0].filter((x) => x.type !== LeafTypes.Empty);
        difference[1] = difference[1].filter((x) => x.type !== LeafTypes.Empty);

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
    async merge(head: HeadInterface): Promise<void> {
        const { isEqual, difference } = await this.compare(head);
        if (isEqual) return;

        let rebuildFrom = Number.MAX_SAFE_INTEGER;
        let mergedAny = false;

        for (const leaf of difference[1]) {
            if (leaf.type !== LeafTypes.SortedEntry) continue;
            const timestamp = await this.processLeafMerging(leaf);
            if (timestamp === undefined) continue; // unverifiable, forged, or lost the conflict
            mergedAny = true;
            if (timestamp < rebuildFrom) rebuildFrom = timestamp;
        }

        // Nothing to apply — don't schedule a rebuild against a bogus timestamp
        // (KNOWN_ISSUES.md #5).
        if (mergedAny) await this.createTaskUpdateLayers(rebuildFrom);
    }

    private async compareNodes(
        layersCount: number,
        root: CID | undefined,
        { layerIndex, position }: PollardLocation,
    ): Promise<[LeafType[], LeafType[]]> {
        const result: [LeafType[], LeafType[]] = [[], []];
        let thisPollard = this.getPollardTreeNode({ layerIndex, position }).pollard;
        const otherPollard = layersCount > layerIndex ? root && (await this.getPollard(root)) : undefined;

        if (!thisPollard && !otherPollard) return result;

        thisPollard = thisPollard || (await createEmptyPollard(this.order));

        const comp = await thisPollard.compare(otherPollard);
        if (comp.isEqual) return result;

        if (layerIndex === 0) {
            result[0] = result[0].concat(comp.difference[0]);
            result[1] = result[1].concat(comp.difference[1]);
            return result;
        }

        const maxPollardLength = Math.max(thisPollard?.length || 0, otherPollard?.length || 0);

        for (let i = 0; i < maxPollardLength; i++) {
            let cid = root;
            if (otherPollard) {
                const leaf = await otherPollard.getLeaf(i);
                if (leaf.type !== LeafTypes.Empty && leaf.type !== LeafTypes.Hash) cid = leaf.link;
            }

            const next = await this.compareNodes(layersCount, cid, {
                layerIndex: layerIndex - 1,
                position: position * maxPollardLength + i,
            });
            result[0] = result[0].concat(next[0]);
            result[1] = result[1].concat(next[1]);
        }

        return result;
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
    private async processLeafMerging(leaf: LeafType): Promise<number | undefined> {
        if (leaf.type !== LeafTypes.SortedEntry) return;
        const cid = leaf.link;

        let entry;
        try {
            // fetchEntry verifies the JWS signature; throws if missing/invalid.
            entry = await fetchEntry(cid, this.heliaController);
        } catch {
            this.log("Rejected leaf %s: entry missing or signature invalid", cid.toString());
            return;
        }

        const timestamp = entry.timestamp;
        const key = entry.key;
        const creator = entry.creator;

        // Authorization on the merge/load path — the signed creator must be allowed
        // to write, or a peer could inject entries the local writer couldn't
        // (KNOWN_ISSUES.md D1). Deterministic, so replicas agree on what they ingest.
        if (!(await this.isAuthorized(creator))) {
            this.log("Rejected leaf %s: writer %s not authorized", cid.toString(), creator.toString());
            return;
        }

        const check = {
            currentTimestamp: Date.now(),
            databaseCreator: this.manifest.creator.toString(),
            currentIdentity: this.identity.cid.toString(),
            entryTimestamp: timestamp,
            entryCreator: creator.toString(),
        };
        if (!(await this.consensusController.execute(check))) {
            this.log("Rejected leaf %s: consensus check failed", cid.toString());
            return;
        }

        const result = await this.sortedItemsStore.set(timestamp, key, cid, creator, entry.deleted === true);
        if (!result.applied) return;

        // Pin the accepted foreign entry: it was fetched (unpinned), and the tree we
        // rebuild will reference it — it must survive GC and restarts (D4).
        await this.heliaController.pin(cid);

        // The winning value differs from anything cached under this key; drop the
        // stale cache entry so the next read refetches (KNOWN_ISSUES.md #1).
        await this.keyValueStorage.delete(key);
        return Math.min(timestamp, result.previousTimestamp ?? timestamp);
    }

    async createTaskUpdateLayers(sortKey: number): Promise<void> {
        this.syncController.addTask(async () => {
            await this.updateLayers(sortKey);
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
            await pollard.append(LeafTypes.SortedEntry, cid, creator, [item.sortField], key);
        }

        await this.handlePollardUpdate(pollard, layerIndex, position);

        pollard = await createEmptyPollard(this.order);
        for (layerIndex++; this.layers[layerIndex - 1].length > 1; layerIndex++) {
            if (this.layers.length === layerIndex) this.layers.push([]);
            position = this.calculatePositionInLayer(startPosition, layerIndex);
            const startIndexInLowerLayer = position * this.maxPollardLength;
            const slicedLayer = this.layers[layerIndex - 1].slice(startIndexInLowerLayer);
            for (const pollardNode of slicedLayer) {
                ({ pollard, position } = await this.handlePollardCreation(pollard, layerIndex, position));
                await pollard.append(LeafTypes.Pollard, await pollardNode.getCID());
            }
            await this.handlePollardUpdate(pollard, layerIndex, position);
        }
    }

    private calculatePositionInLayer(entryPosition: number, layerIndex: number = 1): number {
        return Math.floor(entryPosition / this.maxPollardLength ** layerIndex);
    }

    private async handlePollardCreation(pollard: PollardInterface, layerIndex: number, position: number) {
        if (!pollard.isFree()) {
            await this.handlePollardUpdate(pollard, layerIndex, position);
            pollard = await createEmptyPollard(this.order);
            position++;
        }
        return { pollard, position };
    }

    private async handlePollardUpdate(pollard: PollardInterface, layerIndex: number, position: number) {
        await pollard.updateLayers();
        await this.heliaController.add(pollard.toJSON());
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

    getPollardTreeNodeLeft(node: PollardNode): PollardNode {
        if (node.position <= 0) throw new Error("No left node");
        if (node.position >= Math.ceil(this.size / 2 ** (this.order * (node.layerIndex + 1))))
            throw new Error("No right node");
        node = node.pollard ? node : this.getPollardTreeNode(node);
        if (!node.pollard || node.layerIndex === 0) {
            return node;
        }
        const order = node.pollard.order;
        return this.getPollardTreeNode({
            layerIndex: node.layerIndex - 1,
            position: node.position * order,
        });
    }

    getPollardTreeNodeChildren(node: PollardNode): PollardNode[] {
        node = node.pollard ? node : this.getPollardTreeNode(node);
        if (!node.pollard || node.layerIndex === 0) {
            return [];
        }
        const order = node.pollard.order;
        return node.pollard.all().map((leaf, index) => {
            const pollardNode = {
                layerIndex: node.layerIndex - 1,
                position: node.position * order + index,
            };
            return this.getPollardTreeNode(pollardNode);
        });
    }

    getPollardTreeNodeParent(node: PollardNode): PollardNode {
        node = node.pollard ? node : this.getPollardTreeNode(node);
        if (!node.pollard) {
            return node;
        }

        const parentLayerIndex = node.layerIndex + 1;
        const parentPosition = this.calculatePositionInLayer(node.position);

        return this.getPollardTreeNode({
            layerIndex: parentLayerIndex,
            position: parentPosition,
        });
    }

    /**
     * Loads the data from the given head into the database.
     * @param head - The head interface containing the root bytes.
     * @returns A promise that resolves when the loading is complete.
     */
    async load(head: HeadInterface): Promise<void> {
        // load() fully replaces local state with the authenticated contents of the
        // remote tree (KNOWN_ISSUES.md #17). The remote pollards are only walked to
        // discover entries; the honest tree is rebuilt from the verified index, so
        // forged leaf structure/metadata cannot survive.
        this.layers.length = 0;
        await this.sortedItemsStore.clear();
        await this.keyValueStorage.clear();
        this.head = undefined;

        let links: CID[] = [head.root];

        while (links.length > 0) {
            const next: CID[] = [];

            for (const link of links) {
                const pollard = await this.getPollard(link);
                if (!pollard) continue; // missing or wrong version — skip
                for (const leaf of pollard.iterator()) {
                    if (leaf.type === LeafTypes.Pollard) next.push(leaf.link);
                    else if (leaf.type === LeafTypes.SortedEntry) await this.processLeafMerging(leaf);
                }
            }
            links = next;
        }
        await this.createTaskUpdateLayers(0);
    }

    private async getPollard(cid: CID): Promise<PollardInterface | undefined> {
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
            let head: HeadInterface;
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

            if (this.size === 0) {
                await this.load(head);
            } else {
                await this.merge(head);
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
    async idle(): Promise<void> {
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
