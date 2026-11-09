import * as jose from "jose";
import Keyv from "keyv";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    createDatabase,
    createEmptyPollard,
    createHead,
    createPolicy,
    createSyncController,
    HeliaController,
    HeliaStorage,
    headStoreKey,
    openDatabase,
    SortedItemsStore,
    SyncController,
    evaluatePolicy,
} from "../src/internal";
import { ENTRY_VERSION, HEAD_VERSION, IdentityKind, LeafKind, loadIdentity } from "../src/internal";
import type { Provenance } from "../src/internal";
import { buildHead, createCustomDb, createTestNode, ForgedLeaf, putSignedEntry, TestNode } from "./helpers";

type Value = { value: string };

/**
 * Regression tests for the six defects confirmed in the November 2026 review
 * (KNOWN_ISSUES.md #24–#29). Each describe block pins one defect.
 */
describe("Integrity hardening (review 2026-11)", () => {
    let node: TestNode;
    let controller: HeliaController;

    beforeAll(async () => {
        node = await createTestNode("integrity");
        controller = new HeliaController(node.helia, node.identity);
    }, 30_000);

    afterAll(async () => {
        await node.stop();
    });

    const leafOf = (e: { cid: CID; creator: CID; timestamp: number; key: string }): ForgedLeaf => ({
        cid: e.cid,
        creator: e.creator,
        sort: [e.timestamp],
        key: e.key,
    });

    async function provenanceLeaf(db: { provenance(k: string): Promise<unknown> }, key: string): Promise<ForgedLeaf> {
        const p = (await db.provenance(key)) as Provenance;
        return { cid: p.entryCid, creator: p.writer, sort: [p.timestamp], key };
    }

    // #24 — signed entries carried no database binding, so an entry written to one
    // database could be wrapped in a head for another database that shares a writer.
    describe("#24 entries are bound to their database", () => {
        it("rejects an entry replayed from another database (load path)", async () => {
            const x = await createDatabase<Value>("replay-x", { helia: node.helia, identity: node.identity });
            const y = await createDatabase<Value>("replay-y", { helia: node.helia, identity: node.identity });
            await x.set("secret", { value: "only in x" });
            await x.waitUntilIdle();

            const head = await buildHead(controller, y.address, [await provenanceLeaf(x, "secret")]);
            await y.syncNewHead(head.cid.bytes);
            await y.waitUntilIdle();

            expect(await y.get("secret")).toBeUndefined();
            expect(y.recordCount).toBe(0);
            await x.close();
            await y.close();
        });

        it("rejects a replayed tombstone (merge path) but accepts entries bound to this database", async () => {
            const x = await createDatabase<Value>("replay-tx", { helia: node.helia, identity: node.identity });
            const y = await createDatabase<Value>("replay-ty", { helia: node.helia, identity: node.identity });
            await y.set("shared", { value: "y keeps this" });
            await x.set("shared", { value: "x" });
            await x.delete("shared"); // newer tombstone, signed by the same writer
            await x.waitUntilIdle();
            await y.waitUntilIdle();

            const bound = await putSignedEntry(controller, "bound", { value: "ok" }, Date.now(), y.address);
            const head = await buildHead(controller, y.address, [await provenanceLeaf(x, "shared"), leafOf(bound)]);
            await y.syncNewHead(head.cid.bytes);
            await y.waitUntilIdle();

            expect(await y.get("shared")).toEqual({ value: "y keeps this" });
            expect(await y.get("bound")).toEqual({ value: "ok" });
            await x.close();
            await y.close();
        });

        it("rejects legacy (unbound) entries in a current database", async () => {
            const db = await createDatabase<Value>("replay-legacy-entry", {
                helia: node.helia,
                identity: node.identity,
            });
            await db.set("seed", { value: "s" });
            await db.waitUntilIdle();
            const legacy = await putSignedEntry(controller, "legacy", { value: "v1" }, Date.now());
            await db.syncNewHead((await buildHead(controller, db.address, [leafOf(legacy)])).cid.bytes);
            await db.waitUntilIdle();
            expect(await db.get("legacy")).toBeUndefined();
            await db.close();
        });

        it("keeps reading legacy entries in a legacy (v1-manifest) database", async () => {
            const db = await createCustomDb<Value>(node, "legacy-db", { manifestVersion: 1 });
            const legacy = await putSignedEntry(controller, "old", { value: "from 3.0.0" }, Date.now());
            const foreign = await putSignedEntry(
                controller,
                "foreign",
                { value: "x" },
                Date.now(),
                CID.parse("bafyreiaoahgfcipjcvbq4k22vtxkxddzhmbmbrfgeowbmn4w34n7yi2eiq"),
            );
            await db.syncNewHead(
                (await buildHead(controller, db.address, [leafOf(legacy), leafOf(foreign)])).cid.bytes,
            );
            await db.waitUntilIdle();
            expect(await db.get("old")).toEqual({ value: "from 3.0.0" });
            // A current entry still has to be bound to THIS database, legacy or not.
            expect(await db.get("foreign")).toBeUndefined();
            await db.close();
        });

        it("rejects signed entries with a malformed shape", async () => {
            const db = await createDatabase<Value>("malformed", { helia: node.helia, identity: node.identity });
            await db.set("seed", { value: "s" });
            await db.waitUntilIdle();
            const now = Date.now();
            const bad = [
                { version: ENTRY_VERSION, manifest: db.address, timestamp: "soon", key: "bad-ts", value: 1 },
                { version: ENTRY_VERSION, manifest: db.address, timestamp: now, key: 42, value: 1 },
                { version: ENTRY_VERSION, manifest: db.address, timestamp: now, key: "both", value: 1, deleted: true },
                { version: ENTRY_VERSION, manifest: db.address, timestamp: now, key: "neither" },
                { version: 99, manifest: db.address, timestamp: now, key: "v99", value: 1 },
            ];
            const leaves: ForgedLeaf[] = [];
            for (const data of bad) {
                const signed = await controller.addSigned(data);
                leaves.push({ cid: signed.cid, creator: signed.creator, sort: [now], key: String(data.key) });
            }
            await db.syncNewHead((await buildHead(controller, db.address, leaves)).cid.bytes);
            await db.waitUntilIdle();
            expect(db.recordCount).toBe(1);
            for (const key of ["bad-ts", "42", "both", "neither", "v99"])
                expect(await db.provenance(key)).toBeUndefined();
            await db.close();
        });
    });

    // #25 — policies received the node-local `currentTimestamp`/`currentIdentity`,
    // so a custom policy could accept an entry on one replica and reject it on
    // another; truthy non-boolean results also authorized.
    describe("#25 policy evaluation is deterministic and strictly boolean", () => {
        it("does not expose node-local inputs to the validation policy (local and merge path)", async () => {
            const db = await createCustomDb<Value>(node, "policy-inputs", {
                consensus: {
                    and: [
                        { "==": [{ var: "currentTimestamp" }, null] },
                        { "==": [{ var: "currentIdentity" }, null] },
                        { "==": [{ var: "entryCreator" }, { var: "databaseCreator" }] },
                    ],
                },
            });
            await db.set("local", { value: "accepted" });
            const merged = await putSignedEntry(controller, "merged", { value: "accepted" }, Date.now(), db.address);
            await db.syncNewHead((await buildHead(controller, db.address, [leafOf(merged)])).cid.bytes);
            await db.waitUntilIdle();
            expect(await db.get("local")).toEqual({ value: "accepted" });
            expect(await db.get("merged")).toEqual({ value: "accepted" });
            await db.close();
        });

        it("authorizes only a literal true result", async () => {
            const make = (logic: unknown) =>
                createPolicy({ version: 1, name: "t", description: "t", logic: logic as never }, controller);
            expect(evaluatePolicy(await make(true), {})).toBe(true);
            expect(evaluatePolicy(await make({ cat: ["a", "b"] }), {})).toBe(false);
            expect(evaluatePolicy(await make({ var: "entryKey" }), { entryKey: "yes" })).toBe(false);
            expect(evaluatePolicy(await make({ "+": [1, 1] }), {})).toBe(false);
        });
    });

    // #26 — compareNodes reused the parent CID for absent children and never
    // aligned a shorter remote tree; a hostile head could also force unbounded work.
    describe("#26 tree comparison is aligned and bounded", () => {
        async function putPollard(build: (p: Awaited<ReturnType<typeof createEmptyPollard>>) => Promise<void>) {
            const pollard = await createEmptyPollard(3);
            await build(pollard);
            await pollard.updateLayers();
            await controller.put(pollard.toJSON()); // unpinned: pinning would walk the DAG
            return pollard.getCID();
        }

        it("merges an entry from a remote tree with fewer layers than ours", async () => {
            const db = await createDatabase<Value>("short-remote", {
                helia: node.helia,
                identity: node.identity,
            });
            for (let i = 0; i < 20; i++) await db.set(`k${i}`, { value: `${i}` });
            await db.waitUntilIdle();
            expect(db.layers.length).toBeGreaterThan(1);

            const fresh = await putSignedEntry(
                controller,
                "from-short-peer",
                { value: "new" },
                Date.now() + 1,
                db.address,
            );
            const head = await buildHead(controller, db.address, [leafOf(fresh)]); // a 1-layer tree
            await db.syncNewHead(head.cid.bytes);
            await db.waitUntilIdle();

            expect(await db.get("from-short-peer")).toEqual({ value: "new" });
            expect(db.recordCount).toBe(21);
            await db.close();
        });

        it("merges between three-layer trees (child positions use the fixed fan-out)", async () => {
            // Separate sync topics so the two replicas only meet through syncNewHead.
            const a = await createDatabase<Value>("three-layers", {
                helia: node.helia,
                identity: node.identity,
                syncController: await createSyncController("three-layers-a", controller),
            });
            for (let i = 0; i < 70; i++) await a.set(`k${i}`, { value: `${i}` });
            await a.waitUntilIdle();
            expect(a.layers.length).toBe(3); // 70 entries at order 3: 9 → 2 → 1 pollards

            const b = await openDatabase<Value>(a.address, {
                helia: node.helia,
                identity: node.identity,
                syncController: await createSyncController("three-layers-b", controller),
            });
            await b.syncNewHead((await a.createHead()).cid.bytes);
            await b.waitUntilIdle();
            expect(b.recordCount).toBe(70);
            await b.set("k-new", { value: "from b" });
            await b.set("k3", { value: "updated by b" });
            await b.waitUntilIdle();

            await a.syncNewHead((await b.createHead()).cid.bytes);
            await a.waitUntilIdle();
            expect(a.recordCount).toBe(71);
            expect(await a.get("k-new")).toEqual({ value: "from b" });
            expect(await a.get("k3")).toEqual({ value: "updated by b" });
            expect((await a.createHead()).root.equals((await b.createHead()).root)).toBe(true);
            await a.close();
            await b.close();
        });

        it("rejects a head whose DAG repeats pollards (load and merge path, no blow-up)", async () => {
            const baitTimestamp = Date.now();
            const empty = await createDatabase<Value>("dag-bomb-load", {
                helia: node.helia,
                identity: node.identity,
            });
            const busy = await createDatabase<Value>("dag-bomb-merge", {
                helia: node.helia,
                identity: node.identity,
            });
            await busy.set("seed", { value: "s" });
            await busy.waitUntilIdle();

            for (const db of [empty, busy]) {
                const bait = await putSignedEntry(controller, "bait", { value: "b" }, baitTimestamp, db.address);
                let child = await putPollard((p) =>
                    p
                        .append(LeafKind.SortedEntry, bait.cid, bait.creator, [bait.timestamp], bait.key)
                        .then(() => undefined),
                );
                const depth = 12; // 8^11 root-to-leaf paths if repeated children were walked
                for (let layer = 1; layer < depth; layer++) {
                    const link = child;
                    child = await putPollard(async (p) => {
                        for (let i = 0; i < 8; i++) await p.append(LeafKind.Pollard, link);
                    });
                }
                const head = await createHead(
                    {
                        version: HEAD_VERSION,
                        manifest: db.address,
                        root: child,
                        timestamp: Date.now(),
                        layers: depth,
                        size: 1,
                    },
                    controller,
                );
                const sizeBefore = db.recordCount;
                const started = Date.now();
                await db.syncNewHead(head.cid.bytes);
                await db.waitUntilIdle();
                expect(Date.now() - started).toBeLessThan(5_000);
                expect(db.recordCount).toBe(sizeBefore);
                expect(await db.get("bait")).toBeUndefined();
            }
            await empty.close();
            await busy.close();
        });

        it("rejects heads with an implausible layer count or size", async () => {
            const db = await createDatabase<Value>("bad-head", { helia: node.helia, identity: node.identity });
            await db.set("seed", { value: "s" });
            await db.waitUntilIdle();
            const entry = await putSignedEntry(controller, "x", { value: "x" }, Date.now(), db.address);
            const honest = await buildHead(controller, db.address, [leafOf(entry)]);
            for (const patch of [{ layers: 1000 }, { layers: 0 }, { layers: 1.5 }, { size: -1 }]) {
                const head = await createHead(
                    {
                        version: HEAD_VERSION,
                        manifest: db.address,
                        root: honest.root,
                        timestamp: Date.now(),
                        layers: 1,
                        size: 1,
                        ...patch,
                    },
                    controller,
                );
                await db.syncNewHead(head.cid.bytes);
                await db.waitUntilIdle();
                expect(await db.get("x")).toBeUndefined();
            }
            await db.close();
        });
    });

    // #27 — iteratorFromIndex called js-sdsl getElementByPos (an O(pos) in-order
    // walk) once per yielded record, making every tree rebuild O(n²).
    describe("#27 positional iteration is linear", () => {
        it("walks from a position with at most one positional lookup", async () => {
            const store = new SortedItemsStore();
            const creator = node.identity.cid;
            for (let i = 0; i < 2_000; i++) {
                // The index only needs distinct CIDs; signing 2k real entries is slow.
                const cid = CID.create(1, 0x71, await sha256.digest(new TextEncoder().encode(`k${i}`)));
                await store.set(1_000 + i, `k${i}`, cid, creator);
            }
            const all: string[] = [];
            for await (const item of store.iterator()) all.push(item.key);

            const map = (store as unknown as { sortedMap: { getElementByPos: (i: number) => unknown } }).sortedMap;
            const spy = vi.spyOn(map, "getElementByPos");
            const fromIndex: { key: string; index: number }[] = [];
            for await (const item of store.iteratorFromIndex(1_234)) fromIndex.push(item);

            expect(fromIndex.map((x) => x.key)).toEqual(all.slice(1_234));
            expect(fromIndex.map((x) => x.index)).toEqual(all.slice(1_234).map((_, i) => 1_234 + i));
            expect(spy.mock.calls.length).toBeLessThanOrEqual(1);
            const empty: unknown[] = [];
            for await (const item of store.iteratorFromIndex(2_000)) empty.push(item);
            expect(empty).toEqual([]);
        });
    });

    // #28 — close() discarded pending rebuilds without persisting a head, so a write
    // acknowledged just before close was not discoverable after reopen.
    describe("#28 close() persists acknowledged writes", () => {
        it("reopens a write made right before close (no idle, no createHead)", async () => {
            const db = await createDatabase<Value>("close-durable", {
                helia: node.helia,
                identity: node.identity,
            });
            const address = db.address;
            await db.set("first", { value: "1" });
            await db.set("last", { value: "2" });
            await db.close();

            const reopened = await openDatabase<Value>(address, { helia: node.helia, identity: node.identity });
            await reopened.waitUntilIdle();
            expect(await reopened.get("first")).toEqual({ value: "1" });
            expect(await reopened.get("last")).toEqual({ value: "2" });
            await reopened.close();
        });

        it("does not hang when a caller-supplied controller's queue is paused", async () => {
            const syncController = (await createSyncController("close-paused", controller)) as SyncController;
            const db = await createDatabase<Value>("close-paused", {
                helia: node.helia,
                identity: node.identity,
                syncController,
            });
            syncController.queue.pause();
            await db.set("queued", { value: "still durable" });
            await Promise.race([
                db.close(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("close() hung")), 5_000)),
            ]);

            const reopened = await openDatabase<Value>(db.address, {
                helia: node.helia,
                identity: node.identity,
            });
            await reopened.waitUntilIdle();
            expect(await reopened.get("queued")).toEqual({ value: "still durable" });
            await reopened.close();
        });

        it("still closes when Helia was stopped first", async () => {
            const other = await createTestNode("integrity-stopped");
            const db = await createDatabase<Value>("close-after-stop", {
                helia: other.helia,
                identity: other.identity,
            });
            await db.set("k", { value: "v" });
            await db.waitUntilIdle();
            await other.stop();
            await expect(db.close()).resolves.toBeUndefined();
        });
    });

    // #29 — fetchIdentity verified the block with its embedded JWK but never checked
    // that this key is the identity's stated public key.
    describe("#29 identity blocks bind their signing key", () => {
        it("rejects an identity whose embedded key differs from its stated public key", async () => {
            const signer = await jose.generateKeyPair("ES384", { extractable: true });
            const claimed = await jose.generateKeyPair("ES384", { extractable: true });
            const data = {
                version: 1,
                name: "forged",
                type: IdentityKind.PublicKey,
                alg: "ES384",
                publicKey: uint8ArrayToString(HeliaStorage.encode(await jose.exportJWK(claimed.publicKey)), "base64"),
            };
            const jws = await new jose.FlattenedSign(HeliaStorage.encode(data))
                .setProtectedHeader({ alg: "ES384", jwk: await jose.exportJWK(signer.publicKey) })
                .sign(signer.privateKey);
            const cid = await controller.add(jws);

            await expect(loadIdentity(cid, controller)).rejects.toThrow(/public key/i);
            // A genuine identity still resolves.
            expect((await loadIdentity(node.identity.cid, controller)).cid.equals(node.identity.cid)).toBe(true);
        });
    });

    // #30 — get() fetched the indexed entry, and a winning merge that landed while
    // the fetch was in flight invalidated the cache *before* get() wrote the old
    // value into it, so the stale value was served from then on.
    describe("#30 the value cache cannot go stale", () => {
        it("serves the new winner after a merge races an in-flight get()", async () => {
            const db = await createDatabase<Value>("cache-race", { helia: node.helia, identity: node.identity });
            await db.set("seed", { value: "s" });
            const base = Date.now();
            // v1 arrives by merge, so it is indexed but not cached: get() must fetch it.
            const v1 = await putSignedEntry(controller, "k", { value: "v1" }, base + 1, db.address);
            await db.syncNewHead((await buildHead(controller, db.address, [leafOf(v1)])).cid.bytes);
            await db.waitUntilIdle();

            // Hold get()'s fetch of v1 open until a newer winner has been merged.
            const signed = db.heliaController as unknown as { getSigned: (cid: CID) => Promise<unknown> };
            const realGetSigned = signed.getSigned.bind(db.heliaController);
            let releaseFetch!: () => void;
            const fetchHeld = new Promise<void>((resolve) => (releaseFetch = resolve));
            let fetchStarted!: () => void;
            const started = new Promise<void>((resolve) => (fetchStarted = resolve));
            signed.getSigned = async (cid: CID) => {
                if (cid.equals(v1.cid)) {
                    fetchStarted();
                    await fetchHeld;
                }
                return realGetSigned(cid);
            };
            try {
                const racingGet = db.get("k");
                await started;
                const v2 = await putSignedEntry(controller, "k", { value: "v2" }, base + 2, db.address);
                await db.syncNewHead((await buildHead(controller, db.address, [leafOf(v2)])).cid.bytes);
                await db.waitUntilIdle();
                releaseFetch();
                await racingGet; // whatever it returns, it must not poison the cache
            } finally {
                signed.getSigned = realGetSigned;
            }

            expect(await db.get("k")).toEqual({ value: "v2" });
            await db.close();
        });

        it("a Keyv shared by two databases cannot mix their values", async () => {
            const shared = new Keyv<Value>();
            const x = await createDatabase<Value>("cache-x", {
                helia: node.helia,
                identity: node.identity,
                valueCache: shared,
            });
            const y = await createDatabase<Value>("cache-y", {
                helia: node.helia,
                identity: node.identity,
                valueCache: shared,
            });
            await x.set("same-key", { value: "x" });
            await y.set("same-key", { value: "y" });
            expect(await x.get("same-key")).toEqual({ value: "x" });
            expect(await y.get("same-key")).toEqual({ value: "y" });
            await x.close();
            await y.close();
        });
    });

    // #31 — processLeafMerging indexed an incoming entry, then pinned it; when the
    // pin threw, a later sync saw the entry as already applied and never pinned it.
    describe("#31 a failed pin leaves nothing half-applied", () => {
        it("retries an entry whose pin failed, and pins it on the next sync", async () => {
            const db = await createDatabase<Value>("pin-fail", { helia: node.helia, identity: node.identity });
            await db.set("seed", { value: "s" });
            await db.waitUntilIdle();
            const entry = await putSignedEntry(controller, "merged", { value: "m" }, Date.now(), db.address);
            const head = await buildHead(controller, db.address, [leafOf(entry)]);

            const pins = db.heliaController as unknown as { pin: (cid: CID) => Promise<void> };
            const realPin = pins.pin.bind(db.heliaController);
            pins.pin = async (cid: CID) => {
                if (cid.equals(entry.cid)) throw new Error("simulated pin failure");
                return realPin(cid);
            };
            try {
                await db.syncNewHead(head.cid.bytes);
                await db.waitUntilIdle();
                expect(await db.provenance("merged")).toBeUndefined(); // not half-applied
            } finally {
                pins.pin = realPin;
            }

            await db.syncNewHead(head.cid.bytes); // the next announcement of the same head
            await db.waitUntilIdle();
            expect(await db.get("merged")).toEqual({ value: "m" });
            expect(await node.helia.pins.isPinned(entry.cid)).toBe(true);
            await db.close();
        });

        it("a pin failure during load() skips the entry instead of aborting the load", async () => {
            const writer = await createDatabase<Value>("pin-fail-load", {
                helia: node.helia,
                identity: node.identity,
            });
            await writer.set("a", { value: "1" });
            await writer.set("b", { value: "2" });
            await writer.waitUntilIdle();
            const head = await writer.createHead();
            const bad = (await writer.provenance("a"))!.entryCid;
            // Same Helia node: drop the writer's persisted head pointer so opening the
            // reader does not restore (load) it before the pin failure is injected.
            await node.helia.datastore.delete(headStoreKey(writer.address));

            const reader = await openDatabase<Value>(writer.address, {
                helia: node.helia,
                identity: node.identity,
                syncController: await createSyncController("pin-fail-load-reader", controller),
            });
            const pins = reader.heliaController as unknown as { pin: (cid: CID) => Promise<void> };
            const realPin = pins.pin.bind(reader.heliaController);
            pins.pin = async (cid: CID) => {
                if (cid.equals(bad)) throw new Error("simulated pin failure");
                return realPin(cid);
            };
            try {
                await reader.syncNewHead(head.cid.bytes);
                await reader.waitUntilIdle();
            } finally {
                pins.pin = realPin;
            }
            expect(await reader.get("b")).toEqual({ value: "2" });
            expect(await reader.provenance("a")).toBeUndefined();
            await reader.close();
            await writer.close();
        });
    });
});
