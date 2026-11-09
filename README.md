# 🧰 DenkMitDB

<!-- all-shields/header-badges:START -->

[![v4.0.0](https://img.shields.io/badge/version-v4.0.0-lightgray.svg?style=flat&logo=)](https://github.com/denkmitdb/denkmitdb/blob/main/CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat&logo=license)](https://github.com/denkmitdb/denkmitdb/blob/main/LICENSE) [![Language: TypeScript](https://img.shields.io/badge/language-typescript-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)

<!-- all-shields/header-badges:END -->

[![CI](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml/badge.svg)](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml)

**Signed fact exchange between agents and organizations that don't trust each
other — peer to peer, no server.** DenkMitDB is a replicated key-value store on
IPFS ([Helia](https://github.com/ipfs/helia)) and libp2p: every record is a
signed, content-addressed block bound to its database, every replica checks the
signature and the database's signed write policy before indexing anything, and
every value can be traced to the key that wrote it. An MCP server and a small
daemon make it shared memory for Claude Code, Codex and any other MCP client.

> ⚠️ **Status: experimental.** The formats are versioned (entries, manifests,
> heads, pollards) and checked on every replica, but the protocol may still
> change. Open items: [KNOWN_ISSUES.md](KNOWN_ISSUES.md); direction:
> [VISION.md](VISION.md) and [ROADMAP.md](ROADMAP.md).

## 🎁 Support: Donate

> This project is **free**, **open source** and I try to provide excellent **free support**. Why donate? I work on this project several hours in my spare time and try to keep it up to date and working. **THANK YOU!**

<!-- all-shields/sponsors-badges:START -->

[![Donate Bitcoin](https://img.shields.io/badge/BTC-1MGfAyH2K9Y6RJXmxbr52nwWeG59Xz2Aje-E38B29.svg?style=flat-square&logo=bitcoin)]()

<!-- all-shields/sponsors-badges:END -->

## 🚀 Quick start: shared memory for agents

```
 Claude Code ─stdio─┐
 Codex ──────stdio──┼─► denkmit-mcp (thin client) ─unix socket─► denkmitd ◄──libp2p──► other peers
 Claude Desktop ────┘                                            (one per machine)
```

1. **Run the daemon** on each machine — one long-lived peer that holds the keys,
   replicates while no agent is open, and serves the agents of that machine:

    ```bash
    npm install -g @denkmitdb/mcp
    DENKMIT_PASSPHRASE='a long secret' DENKMIT_ACCESS=namespace-per-writer denkmitd
    ```

    The first daemon creates a database and logs its address; on other machines
    set `DENKMIT_DB=<address>` and `DENKMIT_PEERS=<a peer's multiaddr>`. A machine
    with a public address and an open port (default `4001`) is a natural *seed* —
    an always-on peer with no special authority.

2. **Connect agents** (no passphrase needed — the daemon holds the key):

    ```bash
    claude mcp add denkmit -- npx -y @denkmitdb/mcp
    ```

3. Agents get `memory_set` / `memory_get` / `memory_list` / `memory_delete` /
   `memory_provenance` / `memory_status`. Under `namespace-per-writer` each
   identity writes only under its own `agents/<identity-cid>/…`, values can be
   encrypted to chosen identities (`encryptFor`), and with
   `DENKMIT_AGENTS=claude-code,codex` each agent signs with its own key.

Full setup — systemd unit, seeds, configuration, per-agent identities:
[mcp/README.md](mcp/README.md). Two-agent walkthrough: `cd mcp && pnpm demo`.

## 💡 Features

-   **Signed, database-bound writes**: every entry is a JWS by a self-certifying identity (its CID), and names the database it belongs to — it cannot be replayed into another one.
-   **Verified before indexed**: replicas check signatures, payload shape, database binding and the write policy for every entry they ingest; forged tree metadata and hostile tree shapes are rejected.
-   **Consensus rules in the manifest**: deterministic [json-logic](https://jsonlogic.com/) rules signed into the database — presets `creator-only` (default), `public`, `prefix-per-writer`, `namespace-per-writer`, identity allowlists, or your own rules over the signer, key and operation (put / delete). See [docs/policies.md](docs/policies.md).
-   **Efficient replication**: peers announce one head CID and Merkle-diff their trees, fetching only what differs.
-   **Deterministic conflicts**: last-write-wins on `(timestamp, entry CID)`; signed tombstones for deletes.
-   **Private values**: a value encrypted to one or more identities replicates like any record, but only the recipients can read it; envelopes are bound to their database, key and writer.
-   **Restart durability**: the last head is persisted and re-validated on open, so a node recovers its own state without a live peer.
-   **Agent tooling**: an MCP server, a per-machine daemon, and separate identities per agent.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## 🤔 Why

Agents run by different owners increasingly need to share facts — findings,
decisions, task state — and nothing in a typical memory stack answers *"who
claimed this, and can I check it without trusting whoever runs the database?"*

DenkMitDB's answer is structural. Every record is signed and bound to its
database; every replica checks the signature, the binding and the database's
signed write policy **before** indexing anything; and provenance is a query
(`provenance(key)`). With `namespace-per-writer` every party — the creator
included — owns exactly its own namespace, so nobody can overwrite or delete
anyone else's facts. None of it needs a server.

It is deliberately narrow: for one owner's agents, SQLite or Postgres is simpler;
for collaborative documents, use Yjs or Automerge. A signature proves which key
wrote a fact — not that the fact is true, and not which person or company holds
the key. See [VISION.md](VISION.md).

## 📦 Use it as a library

```bash
npm install @denkmitdb/denkmitdb helia @helia/libp2p @helia/bitswap @ipld/dag-cbor \
    @libp2p/tcp @libp2p/identify @libp2p/floodsub @chainsafe/libp2p-noise @chainsafe/libp2p-yamux
```

```typescript
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { withBitswap } from "@helia/bitswap";
import { withLibp2pLight } from "@helia/libp2p";
import * as dagCbor from "@ipld/dag-cbor";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { createHeliaLight } from "helia";
import { createDatabase, createIdentity, type HeliaNode } from "@denkmitdb/denkmitdb";

// A light Helia with the libp2p and bitswap mixins (in-memory stores here; pass
// FsBlockstore/FsDatastore for persistence).
const node = withBitswap(
    withLibp2pLight(createHeliaLight({ codecs: [dagCbor] }), {
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: { identify: identify(), pubsub: floodsub({ emitSelf: true }) },
    }),
);
await node.start();
const helia = node as unknown as HeliaNode;

const identity = await createIdentity("alice", "a passphrase", helia);
const db = await createDatabase<{ value: string }>("team-facts", {
    helia,
    identity,
    consensus: { access: "namespace-per-writer" },
});
console.log("database address:", db.address.toString()); // share it; others use openDatabase

const mine = `agents/${identity.cid.toString()}/`;
await db.set(`${mine}decision`, { value: "ship 4.0.0" });
console.log(await db.get(`${mine}decision`), await db.provenance(`${mine}decision`));

for await (const [key, value] of db.entries()) console.log(key, value);

await db.close(); // persists the head
await node.stop();
```

More:

- **Open an existing database:** `openDatabase(address, { helia, identity })`;
  connect to a peer that has it and the head arrives over pubsub.
- **Custom consensus rules:** `createDatabase(name, { consensus: { access: { policy }, validity } })` —
  see [docs/policies.md](docs/policies.md).
- **Private values:** `encryptValueFor([identity, bob], value, { database, key, writer })`
  and `decryptValue(identity, value, expectedContext)` — see `src/encryption.ts`.
- **Sign as another identity** (e.g. one per agent): `db.set(key, value, { identity: agentIdentity })`.
- A runnable version of the snippet is [examples/example.ts](examples/example.ts).

### API at a glance

The package exports only this; everything else is internal.

| | |
|---|---|
| `createDatabase(name, options)` | New database. `options`: `helia`, `identity`; optional `consensus: { access, validity }` — `access` is a preset (`"creator-only"` default, `"public"`, `"prefix-per-writer"`, `"namespace-per-writer"`), `{ allowlist }` or `{ policy }` (custom json-logic), `validity` a json-logic policy; optional `subtreeLeaves` (default 8), `valueCache`. |
| `openDatabase(address, options)` | Open by address (CID or string); the consensus rules always come from the signed manifest. |
| `Database<T>` | `get`, `set`, `delete`, `provenance` (→ `entryCid`, `writer`, `timestamp`, `deleted`), `keys`, `entries`, `waitUntilIdle`, `announceHead`, `close`; `address`, `identity`, `manifest`, `consensus`, `recordCount`. Writes take `{ identity }` to sign as another local identity. |
| `createIdentity` / `openIdentity` / `hasIdentity` | Local signing identities (`SigningIdentity`), private key encrypted with a passphrase. |
| `fetchIdentity(cid, helia)` | Someone else's public `Identity`: verify, encrypt to. |
| `encryptValueFor` / `decryptValue` / `isEncryptedValue` / `encryptedValueRecipients` | Values sealed to recipients. |

## 📈 Performance

`node scripts/bench.mjs 10000` (in-memory stores, single writer, ~40-byte values —
orders of magnitude, not SLAs):

| Operation | dev machine | 4 vCPU arm64 VM |
|---|---:|---:|
| `set()` — sign + index + Merkle rebuild (coalesced) | 4.1 ms | 6.7 ms |
| `get()` warm (cache) | 0.007 ms | 0.03 ms |
| `get()` cold (blockstore fetch + JWS verify) | 1.1 ms | 3.2 ms |
| `keys()` full walk (10k keys) | 0.001 ms | 0.002 ms |
| Reopen from persisted head (per record) | 0.55 ms | 0.69 ms |
| Full replication to a fresh peer (per entry) | 14.3 ms | 10.5 ms |

Bulk replication is the known wall (fetch-latency-bound; batch sync and a
persisted materialized index are on the roadmap).

## 📚 Documentation

| Document | Contents |
|---|---|
| [mcp/README.md](mcp/README.md) | MCP server and daemon: setup, seeds, configuration, per-agent identities, private values |
| [docs/policies.md](docs/policies.md) | Consensus rules: access presets, validity rules, inputs (`entryCreator`, `entryKey`, `entryOperation`, …), determinism |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, the Merkle tree, write/read paths, sync, trust model, deployment |
| [specs/ordering.md](specs/ordering.md) | Accepted spec: composite sort key, last-write-wins, format versioning, entry binding |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Every verified defect with its fix and test, and the open design concerns |
| [VISION.md](VISION.md) | Strategy: the focus on signed fact exchange between untrusting parties |
| [ROADMAP.md](ROADMAP.md) | What is done and what comes next |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/launch/show-hn.md](docs/launch/show-hn.md) | Launch post draft |
| [docs/api/](docs/api/README.md) | Generated API reference (typedoc; `pnpm docs` regenerates only this folder) |
| [CODEX_REVIEW.md](CODEX_REVIEW.md), [PHASE_PRIORITIES.md](PHASE_PRIORITIES.md) | Historical independent reviews (July 2026) |

## 🛠️ Development

```bash
corepack enable        # provides the pinned pnpm version (pnpm 12)
pnpm install
pnpm lint              # eslint over src, test, examples and configs (zero warnings)
pnpm typecheck         # TypeScript 7 over sources, tests and configs
pnpm build
pnpm test              # vitest: unit + integration (real libp2p nodes over TCP)
pnpm test:package      # packs the tarball and smoke-imports the packed code
cd mcp && pnpm build && pnpm smoke && pnpm smoke:daemon
```

Requires **Node 22+**. CI runs all of the above on Node 22 and 24 for every push
and pull request. TypeScript 7 builds the code; typescript-eslint and typedoc use
the TypeScript 6 API side by side (see `package.json`).

## 👨‍💻 Contributing

Contributions are welcome — please open an issue first for anything substantial.
Every fix in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) comes with a regression test that
fails on the code before the fix; please keep that discipline.

## 💫 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🦄 Contact

For more information, please contact the project maintainer at [askar@zhakenov.pro](mailto:askar@zhakenov.pro).
