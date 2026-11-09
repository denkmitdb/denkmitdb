# 🧰 DenkMitDB

<!-- all-shields/header-badges:START -->

[![v4.0.0](https://img.shields.io/badge/version-v4.0.0-lightgray.svg?style=flat&logo=)](https://github.com/denkmitdb/denkmitdb/blob/main/CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat&logo=license)](https://github.com/denkmitdb/denkmitdb/blob/main/LICENSE) [![Language: TypeScript](https://img.shields.io/badge/language-typescript-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)

<!-- all-shields/header-badges:END -->

[![CI](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml/badge.svg)](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml)

**Shared, signed memory for AI agents — peer to peer, no central server.**

DenkMitDB lets Claude Code, Codex, Claude Desktop and other MCP clients exchange
notes, findings and decisions — across your own machines or with someone else's
agents. Each machine runs a small background process, `denkmitd`, that keeps a
local copy and syncs with its peers. Every write is signed, so anyone can check
which identity published it, and the database's rules keep each participant's
records under that participant's control. Signatures establish authorship, not
truth.

**Start here:**
[🚀 Connect your agents](docs/quickstart.md) (10 minutes, no internals) ·
[📦 Use the TypeScript library](#-use-it-as-a-library) ·
[🔍 How it works](ARCHITECTURE.md)

> ⚠️ **Experimental.** The formats are versioned and checked on every replica,
> but the protocol may still change. Open items: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## 🚀 Quick start: shared memory for agents

```
 Claude Code ─stdio─┐
 Codex ──────stdio──┼─► denkmit-mcp ─local socket─► denkmitd ◄──peer to peer──► other machines
 Claude Desktop ────┘                               (one per machine)
```

```bash
npm install -g @denkmitdb/mcp
printf 'Passphrase (typing is hidden): '; stty -echo; read -r DENKMIT_PASSPHRASE; stty echo; echo
export DENKMIT_PASSPHRASE
DENKMIT_ACCESS=namespace-per-writer denkmitd          # keeps running: leave this terminal open
```

In a second terminal:

```bash
claude mcp add denkmit --env DENKMIT_DAEMON=require -- denkmit-mcp
```

Then ask your agent: *"Check your shared memory status, save a note in your own
area, and read it back."* A second agent — on this machine or another one — reads
it with *"List everything in shared memory and who wrote it."*

The [quick start guide](docs/quickstart.md) walks through it step by step: what
you should see, Codex and Claude Desktop, adding a second machine or a friend's
agents, what others can see, and troubleshooting. Reference for the daemon and
its settings: [mcp/README.md](mcp/README.md).

> Plain notes are readable by everyone who has the memory — the rules limit who
> *writes*. Encrypt what must stay private.

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
| `encryptValueFor` / `decryptValue` / `isEncryptedValue` / `encryptedValueRecipients` | Values sealed to recipients, bound to a required context `{ database, key, writer }`. |
| `DenkmitError` / `isDenkmitError(e, code)` | Every intended failure has a stable `code` (`ACCESS_DENIED`, `VALIDITY_REJECTED`, `INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `UNAVAILABLE`, `INVALID_SIGNATURE`, `MALFORMED`, `UNSUPPORTED_VERSION`, `KEY_UNAVAILABLE`, `INVALID_PASSPHRASE`, `INTERNAL`); match on the code, not the message. |

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

**Using it with agents**

| Document | Contents |
|---|---|
| [docs/quickstart.md](docs/quickstart.md) | Ten minutes from install to agents sharing notes |
| [mcp/README.md](mcp/README.md) | The MCP server and daemon: tools, settings, seeds, per-agent identities, private values, running as a service |
| [docs/policies.md](docs/policies.md) | Consensus rules: who may write what (presets), which entries are valid, custom rules |

**Building on it**

| Document | Contents |
|---|---|
| [API at a glance](#api-at-a-glance) and [docs/api/](docs/api/README.md) | The public API; generated reference (`pnpm docs`) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, the Merkle tree, write/read paths, sync, trust model, deployment |
| [specs/ordering.md](specs/ordering.md) | Accepted spec: sort key, last-write-wins, format versioning, entry binding |
| [specs/delegation.md](specs/delegation.md) | Draft: owners delegate scoped, time-bounded write rights to device and agent keys |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Every verified defect with its fix and test, and the open design concerns |

**The project**

| Document | Contents |
|---|---|
| [VISION.md](VISION.md) · [ROADMAP.md](ROADMAP.md) | Focus and direction; what is done and what comes next |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

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

## 🎁 Support: Donate

> This project is **free**, **open source** and I try to provide excellent **free support**. Why donate? I work on this project several hours in my spare time and try to keep it up to date and working. **THANK YOU!**

<!-- all-shields/sponsors-badges:START -->

[![Donate Bitcoin](https://img.shields.io/badge/BTC-1MGfAyH2K9Y6RJXmxbr52nwWeG59Xz2Aje-E38B29.svg?style=flat-square&logo=bitcoin)]()

<!-- all-shields/sponsors-badges:END -->

## 💫 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🦄 Contact

For more information, please contact the project maintainer at [askar@zhakenov.pro](mailto:askar@zhakenov.pro).
