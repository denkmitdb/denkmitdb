import * as codec from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";

import { LeafType, LeafTypes, POLLARD_VERSION, PollardInput, PollardInterface, PollardOptions, PollardType } from "../../types";
import { createLeaf, isLeavesEqual } from "./leaf";

/**
 * Represents a Pollard data structure.
 * The Pollard data structure is used for efficient storage and retrieval of data in a tree-like structure.
 * It supports operations like appending data, retrieving data, updating layers, and comparing with other Pollard instances.
 */
class Pollard implements PollardInterface {
    readonly version = POLLARD_VERSION;
    readonly order: number;
    readonly maxLength: number;
    readonly codec;
    private readonly _hashFunc: (data: Uint8Array) => Promise<Uint8Array>;
    private _layers: LeafType[][];
    private _length: number = 0;
    private _needUpdate: boolean = true;
    private _cid: CID | undefined;

    /**
     * Represents a Pollard object.
     */
    constructor(pollard: PollardInput, options: PollardOptions = {}) {
        if (pollard.order <= 0 || pollard.order >= 8) {
            throw new Error("Order must be greater than 0 or less than or equal 8");
        }
        this.order = pollard.order;
        this.maxLength = 2 ** pollard.order;
        this.codec = codec.code;
        this._hashFunc = async (data) => (await sha256.digest(data)).digest;
        this._hashFunc = options.hashFunc || this._hashFunc;

        if (pollard.layers && pollard.length) {
            this._layers = Object.assign(pollard.layers);
            this._length = pollard.length;
        } else {
            this._layers = Array.from({ length: this.order }, (_, i) =>
                Array.from({ length: 2 ** (this.order - i) }, () => createLeaf()),
            );
        }

        this._needUpdate = options.noUpdate ?? false;

        this._cid = options.cid;
    }

    /**
     * Appends a leaf to the tree.
     * 
     * @param type - The type of the leaf.
     * @param data - The data to be appended. It can be a CID, Uint8Array, or a string.
     * @param options - Additional options for appending the leaf (optional).
     * @returns A promise that resolves to a boolean indicating whether the leaf was successfully appended.
     * @throws If the data type is not supported.
     */
    async append(
        type: LeafTypes,
        data: CID | Uint8Array | string,
        options?: { sortFields?: number[]; key?: string },
    ): Promise<boolean> {
        let bytes: Uint8Array;

        if (data instanceof Uint8Array) {
            bytes = data;
        } else if (typeof data === "string") {
            bytes = uint8ArrayFromString(data);
        } else if (data instanceof CID) {
            bytes = data.bytes;
        } else {
            throw new Error("Unsupported type");
        }

        const leaf = createLeaf(type, bytes, options?.sortFields, options?.key);
        const res = this.addLeaf(leaf);
        if (res) await this.updateLayersOneLeaf(this._length - 1);
        return res;
    }

    isFree(): boolean {
        return this._length < this.maxLength;
    }

    addLeaf(leaf: LeafType): boolean {
        if (!this.isFree()) return false;

        this._layers[0][this._length] = Object.assign(leaf);
        this._length++;

        this._needUpdate = true;

        return true;
    }

    getLeaf(index: number): LeafType {
        return this._layers[0][index];
    }

    get length(): number {
        return this._length;
    }

    async updateLayersOneLeaf(index: number): Promise<CID> {
        if (!this._needUpdate && this._cid) return this._cid;

        let startIndex = index >> 1 << 1;

        for (let i = 0; i < (this.order - 1); i++) {
            const hash1 = this._layers[i][startIndex][1];
            const hash2 = this._layers[i][startIndex + 1][1];
            const combined = new Uint8Array(hash1.length + hash2.length);
            combined.set(hash1);
            combined.set(hash2, hash1.length);
            const hash = await this._hashFunc(combined);
            const nexLayerIndex = startIndex >> 1;
            this._layers[i + 1][nexLayerIndex] = createLeaf(LeafTypes.Hash, hash);
            startIndex = nexLayerIndex >> 1 << 1;
        }
        
        this._needUpdate = false;
        const buf = this.encode();
        const hash = await sha256.digest(buf);
        this._cid = CID.createV1(codec.code, hash);

        return this._cid;
    }

    /**
     * Updates the layers of the Pollard object.
     * 
     * @returns A Promise that resolves to the CID (Content Identifier) of the updated object.
     */
    async updateLayers(startPosition: number = 0): Promise<CID> {
        let startIndex = startPosition >> 1 << 1;

        for (let i = 0; i < this.order - 1; i++) {
            for (let j = startIndex; j < 2 ** (this.order - i); j += 2) {
                const hash1 = this._layers[i][j][1];
                const hash2 = this._layers[i][j + 1][1];
                const combined = new Uint8Array(hash1.length + hash2.length);
                combined.set(hash1);
                combined.set(hash2, hash1.length);
                const hash = await this._hashFunc(combined);
                const nextLayerIndex = j >> 1;
                this._layers[i + 1][nextLayerIndex] = createLeaf(LeafTypes.Hash, hash);
            }
            startIndex = startIndex >> 1 >> 1 << 1;
        }

        this._needUpdate = false;
        const buf = this.encode();
        const hash = await sha256.digest(buf);
        this._cid = CID.createV1(codec.code, hash);
        
        return this._cid;
    }

    get cid(): CID {
        if (this._needUpdate || !this._cid) {
            throw new Error("Pollard is not updated. Please, use getCID() method to get CID.");
        }
        return this._cid;
    }

    async getNode(layerIndex: number, position: number): Promise<LeafType> {
        if (this._needUpdate) {
            await this.updateLayers();
        }

        if (layerIndex > this.order || position >= 2 ** (this.order - layerIndex)) {
            return createLeaf();
        }

        if (layerIndex === this.order && position === 0) {
            return await this.getRoot();
        }

        return this._layers[layerIndex][position];
    }

    /**
     * Retrieves all the elements in the first layer of the Pollard object.
     * 
     * @returns An array of LeafType elements representing all the elements in the first layer.
     */
    all(): LeafType[] {
        return this._layers[0];
    }

    /**
     * Returns an iterator that yields each leaf in the tree.
     * @returns A generator that yields each leaf in the tree.
     */
    *iterator(): Generator<LeafType> {
        for (const leaf of this._layers[0]) {
            yield leaf;
        }
    }

    async getRoot(): Promise<LeafType> {
        if (this._needUpdate || !this._cid) {
            this._cid = await this.updateLayers();
        }

        return createLeaf(LeafTypes.Pollard, this._cid.bytes);
    }

    get layers(): LeafType[][] {
        if (this._needUpdate) {
            // throw new Error("Pollard is not updated. Please, use getLayers() method to get layers.");
        }
        return this._layers;
    }

    async getLayers(): Promise<LeafType[][]> {
        if (this._needUpdate) {
            await this.updateLayers();
        }
        return this._layers;
    }

    /**
     * Retrieves the CID (Content Identifier) associated with this instance.
     * If the CID is not available or needs to be updated, it will be fetched by calling the `updateLayers` method.
     * 
     * @returns A Promise that resolves to the CID.
     */
    async getCID(): Promise<CID> {
        if (this._needUpdate || !this._cid) {
            this._cid = await this.updateLayers();
        }

        return this._cid;
    }

    /**
     * Converts the Pollard object to a JSON representation.
     * @returns The JSON representation of the Pollard object.
     * @throws If the Pollard object is not updated.
     */
    toJSON(): Omit<PollardType, "cid"> {
        if (this._needUpdate) {
            throw new Error("Pollard is not updated");
        }
        return {
            version: this.version,
            order: this.order,
            maxLength: this.maxLength,
            length: this._length,
            layers: this._layers,
        };
    }

    encode(): Uint8Array {
        return codec.encode(this.toJSON());
    }

    get size(): number {
        if (this._needUpdate) {
            return 0;
        }
        return this.layers.reduce((acc, layer) => acc + layer.reduce((acc, u) => acc + u.length, 0), 0);
    }

    /**
     * Compares the nodes of two Pollard trees in a specific order.
     * @param other - The other Pollard tree to compare with.
     * @param layerIndex - The index of the current layer in the tree.
     * @param position - The position of the node in the current layer.
     * @returns A promise that resolves to an array of two arrays, where the first array contains the nodes from the current tree and the second array contains the nodes from the other tree.
     */
    private async comparePollardNodesOrdered(
        other: PollardInterface,
        layerIndex: number,
        position: number,
    ): Promise<[LeafType[], LeafType[]]> {
        const result: [LeafType[], LeafType[]] = [[], []];
        const leaf1 = await this.getNode(layerIndex, position);
        const leaf2 = await other.getNode(layerIndex, position);
        let next;

        if (isLeavesEqual(leaf1, leaf2)) {
            result[0] = new Array(2 ** layerIndex).fill(createLeaf());
            result[1] = new Array(2 ** layerIndex).fill(createLeaf());
            return result;
        }

        if (layerIndex === 0) {
            result[0][0] = leaf1;
            result[1][0] = leaf2;
            return result;
        }

        const nextPosition = position * 2;

        next = await this.comparePollardNodesOrdered(other, layerIndex - 1, nextPosition);

        result[0] = result[0].concat(next[0]);
        result[1] = result[1].concat(next[1]);

        next = await this.comparePollardNodesOrdered(other, layerIndex - 1, nextPosition + 1);

        result[0] = result[0].concat(next[0]);
        result[1] = result[1].concat(next[1]);

        return result;
    }

    async compare(other?: PollardInterface): Promise<{ isEqual: boolean; difference: [LeafType[], LeafType[]] }> {
        if (this.order !== other?.order) {
            throw new Error("Orders are different");
        }

        other = other || await createEmptyPollard(this.order);

        const difference = await this.comparePollardNodesOrdered(other, this.order, 0);

        const isEqual = difference.every((x) => x.every((y) => y[0] === LeafTypes.Empty));

        return { isEqual, difference };
    }
}

/**
 * Creates a new Pollard instance with the provided configuration and options.
 *
 * @param pollard - The partial configuration for the Pollard instance.
 * @param options - The options for the Pollard instance.
 * @returns A Promise that resolves to the created Pollard instance.
 */
export async function createPollard(pollard: PollardInput, options: PollardOptions = {}): Promise<PollardInterface> {
    const res = new Pollard(pollard, options);
    if(options.noUpdate) return res;
    await res.updateLayers();
    return res;
}

/**
 * Creates an empty Pollard with the specified order.
 * @param order - The order of the Pollard.
 * @returns A Promise that resolves to a PollardInterface representing the empty Pollard.
 */
export async function createEmptyPollard(order: number): Promise<PollardInterface> {
    const pollard: PollardInput = {
        order,
        length: 0,
        layers: Array.from({ length: order }, (_, i) =>
            Array.from({ length: 2 ** (order - i) }, () => createLeaf())),
    };
    return await createPollard(pollard);
}

