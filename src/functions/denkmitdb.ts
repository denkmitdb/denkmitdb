import type { Logger } from "@libp2p/interface";
import Keyv from "keyv";
import { CID } from "multiformats/cid";
import { createEmptyPollard, createEntry, createLeaf, createPollard, fetchEntry } from ".";
import {
    ConsensusControllerInterface,
    ConsensusData,
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
    PollardInterface,
    PollardLocation,
    PollardNode,
    PollardType,
    SyncControllerInterface,
} from "../types";

import { createConsensus, fetchConsensus } from "./consensus";
import { createHead, fetchHead } from "./head";
import { createManifest, fetchManifest } from "./manifest";
import { createSyncController } from "./sync";
import { HeliaController, emptyCID } from "./utils/helia";
import { SortedItemsStore } from "./utils/sortedItems";

// class TimestampConsensusController {} // TODO: Implement TimestampConsensusController

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

    const empty = await emptyCID();
    const manifestInput: ManifestData = {
        version: MANIFEST_VERSION,
        name,
        type: "denkmit-database-key-value",
        order: 3,
        consensus: consensusController.cid,
        access: empty, // TODO: Implement TimestampConsensusController
        timestamp: Date.now(),
    };
    const manifest = await createManifest(manifestInput, heliaController);
    const syncController = options.syncController ?? (await createSyncController(manifest.name, heliaController));

    const mdb: DenkmitDatabaseInput<T> = {
        manifest,
        heliaController,
        identity,
        keyValueStorage: options.keyValueStorage,
        syncController,
        consensusController,
    };
    const dmdb = new DenkmitDatabase<T>(mdb);
    dmdb.setupSync();

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
    const syncController = await createSyncController(manifest.name, heliaController);
    const consensusController = await fetchConsensus(manifest.consensus, heliaController);

    const mdb: DenkmitDatabaseInput<T> = {
        manifest,
        heliaController,
        identity,
        keyValueStorage: options.keyValueStorage,
        syncController,
        consensusController,
    };

    const dmdb = new DenkmitDatabase<T>(mdb);
    dmdb.setupSync();

    return dmdb;
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
    readonly keyValueStorage: Keyv<T, Record<string, T>>;
    private sortedItemsStore: SortedItemsStore;
    private readonly syncController: SyncControllerInterface;
    private head?: HeadInterface;
    private consensusController: ConsensusControllerInterface;
    private log: Logger;

    constructor(mdb: DenkmitDatabaseInput<T>) {
        this.manifest = mdb.manifest;
        this.layers = [];
        this.keyValueStorage = mdb.keyValueStorage ?? new Keyv<T, Record<string, T>>();
        this.sortedItemsStore = new SortedItemsStore();
        this.maxPollardLength = 2 ** mdb.manifest.order;
        this.heliaController = mdb.heliaController;
        this.syncController = mdb.syncController;
        this.consensusController = mdb.consensusController;
        this.log = this.heliaController.helia.logger.forComponent("denkmitdb:denkmitdb");
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
        const check = {
            currentTimestamp: Date.now(),
            databaseCreator: this.manifest.creator.toString(),
            currentIdentity: this.identity.cid.toString(),
            entryTimestamp: entry.timestamp,
            entryCreator: entry.creator.toString(),
        };
        if (!(await this.consensusController.execute(check))) throw new Error("Consensus failed");
        await this.sortedItemsStore.set(entry.timestamp, key, entry.cid, entry.creator);
        await this.keyValueStorage.set(key, value);
        await this.createTaskUpdateLayers(entry.timestamp);
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
        const value = await this.keyValueStorage.get(key);
        if (value) return value;
        const item = await this.sortedItemsStore.getByKey(key);
        if (!item) return;
        const entry = await fetchEntry<T>(item.cid, this.heliaController);
        if (!entry) return;
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
            if (value) yield [key, value];
        }
    }

    /**
     * Closes the DenkmitDB instance.
     *
     * @returns A promise that resolves when the DenkmitDB instance is closed.
     */
    async close(): Promise<void> {
        await this.syncController.close();
        await this.keyValueStorage.clear();
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

        return this.head;
    }

    async createHead(): Promise<HeadInterface> {
        return (await this.createOnlyNewHead()) || this.head!;
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

        let smallestTimestamp = Number.MAX_SAFE_INTEGER;

        for (const leaf of difference[1]) {
            if (leaf.type !== LeafTypes.SortedEntry) continue;
            const timestamp = await this.processLeafMerging(leaf);
            if (!timestamp) throw new Error("Invalid timestamp");
            if (timestamp < smallestTimestamp) smallestTimestamp = timestamp;
        }

        await this.createTaskUpdateLayers(smallestTimestamp);
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

    private async processLeafMerging(leaf: LeafType): Promise<number | undefined> {
        if (leaf.type !== LeafTypes.SortedEntry) return;
        const cid = leaf.link;
        const timestamp = leaf.sort[0];
        const key = leaf.key;
        const creator = leaf.creator;

        const check = {
            currentTimestamp: Date.now(),
            databaseCreator: this.manifest.creator.toString(),
            currentIdentity: this.identity.cid.toString(),
            entryTimestamp: timestamp,
            entryCreator: creator.toString(),
        };
        if (!(await this.consensusController.execute(check))) throw new Error("Consensus failed");

        await this.sortedItemsStore.set(timestamp, key, cid, creator);
        return timestamp;
    }

    async createTaskUpdateLayers(sortKey: number): Promise<void> {
        this.syncController.addTask(async () => {
            await this.updateLayers(sortKey);
        });
    }

    async updateLayers(sortKey: number): Promise<void> {
        let index = 0;
        if (sortKey > 0) {
            const it = await this.sortedItemsStore.find(sortKey);
            index = it.index;
        }
        const startIndex = Math.floor(index / this.maxPollardLength) * this.maxPollardLength;
        const startItem = await this.sortedItemsStore.getByIndex(startIndex);
        const startSortField = startItem.sortField;
        const startPosition = this.calculatePositionInLayer(startIndex);

        let pollard = await createEmptyPollard(this.order);
        let layerIndex = 0;

        let position = startPosition;

        for await (const item of this.sortedItemsStore.iteratorFrom(startSortField)) {
            const { cid, key, creator } = item;
            ({ pollard, position } = await this.handlePollardCreation(pollard, layerIndex, position));
            pollard.append(LeafTypes.SortedEntry, cid, creator, [item.sortField], key);
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
                pollard.append(LeafTypes.Pollard, await pollardNode.getCID());
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
        let leaves: LeafType[] = [createLeaf(LeafTypes.Pollard, head.root)];

        this.layers.length = 0;

        while (leaves.length > 0) {
            const leavesNext: LeafType[] = [];

            this.layers.unshift([]);

            for (const leaf of leaves) {
                if (leaf.type !== LeafTypes.Pollard) throw new Error("Invalid leaf type");
                const pollard = await this.getPollard(leaf.link);
                if (!pollard) throw new Error("Invalid pollard");
                this.layers[0].push(pollard);
                for (const leaf of pollard.iterator()) {
                    switch (leaf.type) {
                        case LeafTypes.Pollard:
                            leavesNext.push(leaf);
                            break;

                        case LeafTypes.SortedEntry:
                            await this.processLeafMerging(leaf);
                            break;
                    }
                }
            }
            leaves = leavesNext;
        }
        await this.createTaskUpdateLayers(0);
    }

    private async getPollard(cid: CID): Promise<PollardInterface | undefined> {
        const pollardInput = await this.heliaController.get<PollardType>(cid);
        if (!pollardInput) return;
        return await createPollard(pollardInput, { cid, noUpdate: true });
    }

    async syncNewHead(data: Uint8Array): Promise<void> {
        const cid = CID.decode(data);
        this.log("syncNewHead", cid);
        this.log("Head cid is", cid);
        this.syncController.addTask(async () => {
            const head = await this.fetchHead(cid);

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
     * Sets up the synchronization process.
     *
     * @returns A Promise that resolves when the setup is complete.
     */
    async setupSync(): Promise<void> {
        this.log("Setup sync");
        await this.syncController.start(async (data: Uint8Array) => await this.syncNewHead(data));
        await this.syncController.addRepetitiveTask(async () => {
            const head = await this.createOnlyNewHead();
            this.log("New head: ", head);
            if (head) await this.syncController.sendHead(head);
        }, 30000);
    }
}
