**@denkmitdb/denkmitdb**

***

# 🧰 DenkMitDB

<!-- all-shields/header-badges:START -->

[![v4.0.0](https://img.shields.io/badge/version-v4.0.0-lightgray.svg?style=flat&logo=)](https://github.com/denkmitdb/denkmitdb/blob/main/CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat&logo=license)](https://github.com/denkmitdb/denkmitdb/blob/main/LICENSE) [![Language: TypeScript](https://img.shields.io/badge/language-typescript-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)

<!-- all-shields/header-badges:END -->

[![CI](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml/badge.svg)](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml)

DenkMitDB is a distributed key-value database built on IPFS ([Helia](https://github.com/ipfs/helia)), using a Merkle tree as the consistency controller. Every record is a signed, content-addressed block; replicas converge by broadcasting a single root CID over libp2p pubsub and diffing Merkle trees to fetch only what they are missing.

> ⚠️ **Status: experimental, approaching v2.** Databases are **creator-only by
> default** (only the creating identity may write; the `access` option selects
> `public`, `prefix-per-writer` or an identity allowlist — see
> [docs/policies.md](_media/policies.md)), every merged entry is signature-verified before
> indexing, records can be deleted via signed tombstones, and a database reopens
> its own last state without a live peer. Remaining pre-release work (API freeze,
> hardening) is tracked in [ROADMAP.md](_media/ROADMAP.md); open items in
> [KNOWN_ISSUES.md](_media/KNOWN_ISSUES.md).

## 🎁 Support: Donate

> This project is **free**, **open source** and I try to provide excellent **free support**. Why donate? I work on this project several hours in my spare time and try to keep it up to date and working. **THANK YOU!**

<!-- all-shields/sponsors-badges:START -->

[![Donate Bitcoin](https://img.shields.io/badge/BTC-1MGfAyH2K9Y6RJXmxbr52nwWeG59Xz2Aje-E38B29.svg?style=flat-square&logo=bitcoin)]()

<!-- all-shields/sponsors-badges:END -->

## 💡 Features

-   **Distributed storage**: all state lives in IPFS as signed, content-addressed dag-cbor blocks.
-   **Efficient replication**: peers exchange one head CID and Merkle-diff their trees, so sync cost scales with the difference, not the database size.
-   **Signed writes**: every entry is a JWS tied to a self-certifying identity (its CID).
-   **Access control**: a deterministic [json-logic](https://jsonlogic.com/) policy in the manifest — creator-only by default, world-writable by explicit opt-in — enforced on local writes and merged entries alike.
-   **Delete**: signed tombstones in the same last-write-wins order as puts; a newer write resurrects the key.
-   **Private values**: encrypt a value to one or more recipient identities (`encryptValueFor` / `decryptValue`) — peers replicate signed ciphertext they cannot read.
-   **Restart durability**: the last head is persisted and re-validated on open, so a node recovers its own state without a live peer.

See [ARCHITECTURE.md](_media/ARCHITECTURE.md) for how the pieces fit together.

## 📈 Performance

`node scripts/bench.mjs 10000` on one developer machine (Node 24, in-memory
stores, single writer, ~40-byte values — orders of magnitude, not SLAs):

| Operation | per-op | ops/s |
|---|---:|---:|
| `set()` — sign + index + Merkle rebuild (coalesced) | 4.1 ms | ~245 |
| `get()` warm (cache) | 0.007 ms | ~144,000 |
| `get()` cold (blockstore fetch + JWS verify) | 1.1 ms | ~890 |
| `keys()` full walk (10k keys) | 0.001 ms | ~730,000 |
| Reopen from persisted head (10k records, restore + reindex) | 0.55 ms | ~1,800 |
| Full replication to a fresh peer (verify + index + rebuild) | 14.3 ms | ~70 |

On a small cloud VM (4 vCPU arm64 Neoverse-N1, November 2026, after the
integrity fixes): `set()` 6.7 ms, cold `get()` 3.2 ms, reopen 0.69 ms/record,
full replication 10.5 ms/entry.

Bulk replication is the known wall (fetch-latency-bound and superlinear at
depth; see ROADMAP.md — batch sync and the persisted materialized index are the
follow-ups).

## 🤔 Why

Agents run by different owners increasingly need to share facts — findings,
decisions, task state — and nothing in a typical memory stack answers *"who
claimed this, and can I check it without trusting whoever runs the database?"*

DenkMitDB's answer is structural. Every record is signed by a self-certifying
identity and bound to its database; every replica checks the signature, the
binding and the database's signed write policy **before** indexing anything; and
provenance is a query (`provenance(key)`). With the `prefix-per-writer` preset
each party owns its own namespace, so nobody can overwrite or delete anyone
else's facts. None of it needs a server.

It is deliberately narrow: for one owner's agents, SQLite or Postgres is simpler;
for collaborative documents, use Yjs or Automerge. *CRDTs solve concurrent
editing among trusted peers; DenkMitDB solves attributable state among peers
that don't trust each other.* A signature proves which key wrote a fact — not
that the fact is true. See [VISION.md](_media/VISION.md) and
[docs/policies.md](_media/policies.md); the two-agent demo is `cd mcp && pnpm demo`.

## 💾 Installation

To set up DenkMitDB, follow these steps:

1. **Install module**:

    ```bash
    npm install --save @denkmitdb/denkmitdb
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

## 🚀 Usage

After installation, you can start using DenkMitDB by following these steps:

1. **Import modules**:

    ```typescript
    import { floodsub } from "@libp2p/floodsub";
    import { noise } from "@chainsafe/libp2p-noise";
    import { yamux } from "@chainsafe/libp2p-yamux";
    import { identify } from "@libp2p/identify";
    import { tcp } from "@libp2p/tcp";
    import { withBitswap } from "@helia/bitswap";
    import { withLibp2pLight } from "@helia/libp2p";
    import * as dagCbor from "@ipld/dag-cbor";
    import { createHeliaLight } from "helia";
    import { createDatabase, createIdentity } from "@denkmitdb/denkmitdb";
    ```

2. **Initialize Helia (with the libp2p and bitswap mixins)**:

    ```typescript
    const helia = withBitswap(
        withLibp2pLight(createHeliaLight({ codecs: [dagCbor] }), {
            addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
            transports: [tcp()],
            connectionEncrypters: [noise()],
            streamMuxers: [yamux()],
            services: {
                identify: identify(),
                pubsub: floodsub({ emitSelf: true }),
            },
        }),
    );
    await helia.start();
    ```

3. **Create new Database Identity and new Database**:

    ```typescript
    const identity = await createIdentity("user", "password", helia);

    const db = await createDatabase("test", { helia, identity });
    console.log("Database address: ", db.address.toString()); // others openDatabase(address, …)
    ```

4. **Add new data to Database**:

    ```typescript
    await db.set("key1", { value: "value1" });
    await db.set("key2", { value: "value2" });

    for await (const e of db.iterator()) {
        console.log(e);
    }
    ```

5. **Retrieve data from Database**:
    ```typescript
    const value1 = await db.get("key1");
    console.log("Value 1: ", value1);
    ```
6. **Private values** (optional) — encrypt to recipients; peers replicate what they cannot read:
    ```typescript
    import { decryptValue, encryptValueFor, fetchIdentity } from "@denkmitdb/denkmitdb";

    const bob = await fetchIdentity(bobIdentityCid, helia); // public key only
    const key = "agents/<me>/for-bob";
    const context = { database: db.address.toString(), key, writer: identity.cid.toString() };
    await db.set(key, await encryptValueFor([identity, bob], { apiKey: "…" }, context));

    // on bob's node — check the context against the record's actual writer:
    const writer = (await db.provenance(key))!.creator.toString();
    const secret = await decryptValue(bobIdentity, await db.get(key), { database: db.address.toString(), key, writer });
    ```
    `decryptValue` returns undefined for non-recipients and for envelopes re-posted
    under another key, writer or database. Everyone still sees the key, the writer,
    the time and the recipients' identity CIDs.

7. **Close Database**
    ```typescript
    await db.close();
    await helia.stop(); // also stops the embedded libp2p
    ```

### API at a glance

The package exports only this; everything else is internal.

| | |
|---|---|
| `createDatabase(name, options)` | New database. `options`: `helia`, `identity`, and either `access` (a preset: `"creator-only"` default, `"public"`, `"prefix-per-writer"`, `"namespace-per-writer"`, `{ allowlist }`) or `accessPolicy` (custom json-logic); optional `validationPolicy`, `order`, `cache`. |
| `openDatabase(address, options)` | Open by address (CID or string); policies always come from the signed manifest. |
| `Database<T>` | `get`, `set`, `delete`, `provenance`, `keys`, `iterator`, `idle`, `announceHead`, `close`; `address`, `identity`, `manifest`, `policies`, `size`. Writes take `{ identity }` to sign as another local identity. |
| `createIdentity` / `openIdentity` / `hasIdentity` | Local signing identities (`SigningIdentity`), private key encrypted with a passphrase. |
| `fetchIdentity(cid, helia)` | Someone else's public `Identity`: verify, encrypt to. |
| `encryptValueFor` / `decryptValue` / `isEncryptedValue` / `encryptedRecipients` | Values sealed to recipients. |

## 📚 Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](_media/ARCHITECTURE.md) | Data model, the pollard Merkle tree, write/read paths, sync protocol, trust model |
| [KNOWN_ISSUES.md](_media/KNOWN_ISSUES.md) | Verified bugs (several pinned by failing tests) and open design concerns |
| [ROADMAP.md](_media/ROADMAP.md) | Where the project is going: spec → correctness → upgrades → features → v2.0.0 |
| [VISION.md](_media/VISION.md) | Post-v2 strategy: verifiable shared memory for AI agents — the MCP server as the product |
| [specs/ordering.md](_media/ordering.md) | Accepted v2 spec: composite sort key, last-write-wins, format versioning |
| [CHANGELOG.md](_media/CHANGELOG.md) | Release history |
| [CODEX_REVIEW.md](_media/CODEX_REVIEW.md) | Independent adversarial review of the Phase 0 safety net (July 2026) |
| [PHASE_PRIORITIES.md](_media/PHASE_PRIORITIES.md) | Independent prioritization review of the remaining Phase 4 work (July 2026) |
| [mcp/](_media/README.md) | MCP server: DenkMitDB as shared, signed agent memory for Claude Code/Codex/any MCP client |
| [docs/policies.md](_media/policies.md) | Policy cookbook: access presets, policy inputs, determinism rules |
| [docs/api/](_media/README-1.md) | Generated API reference (typedoc; `pnpm docs` regenerates only this folder) |

## 🛠️ Development

```bash
corepack enable        # provides the pinned pnpm version
pnpm install
pnpm test              # vitest: unit + integration (real libp2p nodes over TCP)
pnpm lint              # eslint over src, test, examples and configs
pnpm typecheck         # tsc over tests/configs (tsconfig.test.json)
pnpm build
pnpm test:package      # packs the tarball and smoke-imports the packed code
```

Notes:

-   Tests marked `it.fails` document known bugs (see [KNOWN_ISSUES.md](_media/KNOWN_ISSUES.md)); when you fix one, flip its test to a normal `it`.
-   Requires **Node 22+** (helia 5 uses `Promise.withResolvers`). CI runs lint, typecheck, build, tests, and the package smoke test on Node 22 and 24 for every push and pull request.

## 👨‍💻 Contributing

We welcome contributions! Please fork the repository and submit pull requests. For major changes, please open an issue to discuss what you would like to change. Good starting points are the items in [KNOWN_ISSUES.md](_media/KNOWN_ISSUES.md) with test pins.

## 💫 License

This project is licensed under the MIT License. See the [LICENSE](_media/LICENSE) file for details.

## 🦄 Contact

For more information, please contact the project maintainer at [askar@zhakenov.pro](mailto:askar@zhakenov.pro).
