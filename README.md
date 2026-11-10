# 🧰 DenkMitDB

<!-- all-shields/header-badges:START -->

[![v4.0.0](https://img.shields.io/badge/version-v4.0.0-lightgray.svg?style=flat&logo=)](https://github.com/denkmitdb/denkmitdb/blob/main/CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat&logo=license)](https://github.com/denkmitdb/denkmitdb/blob/main/LICENSE) [![Language: TypeScript](https://img.shields.io/badge/language-typescript-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)

<!-- all-shields/header-badges:END -->

[![CI](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml/badge.svg)](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml)

**A peer-to-peer database where every record is signed and every replica
enforces the same write rules — no operator to trust.**

DenkMitDB is a replicated key-value database for parties that share state but
not a server: services, devices, organizations, AI agents. Every entry is signed
by a self-certifying identity and bound to its database. Every replica checks the
signature and the database's own write rules — small programs signed into the
database's address — before it keeps anything. Replicas sync peer to peer over
libp2p (Helia/IPFS). An always-on peer helps others find each other; it can
withhold or observe, but it cannot forge, alter or reorder. Signatures establish
authorship, not truth.

**First application: shared memory for AI agents.** A DenkMitDB node, `denkmitd`,
and a thin MCP client, `denkmit-mcp`, let Claude Code, Codex, Claude Desktop and
other MCP clients exchange signed notes, findings and decisions — across your
own machines or with someone else's agents.

| Package | What it is |
|---|---|
| [`@denkmitdb/denkmitdb`](#-use-it-as-a-library) | The platform: the database library and its wire formats |
| [`@denkmitdb/node`](node/README.md) | `denkmitd`, a long-lived peer: keys, the database, replication, a local API over Unix sockets |
| [`@denkmitdb/mcp`](mcp/README.md) | The agent application: `denkmit-mcp` for MCP clients |

**Start here:**
[📦 Use the library](#-use-it-as-a-library) ·
[🤖 Connect your agents](docs/quickstart.md) (10 minutes, no internals) ·
[🔍 How it works](ARCHITECTURE.md) ·
[🧭 How it compares](#-how-it-compares)

> ⚠️ **Experimental.** The formats are versioned and checked on every replica,
> but the protocol may still change. Open items: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## 💡 Features

-   **Signed, database-bound writes**: every entry is a JWS by a self-certifying identity (its CID), and names the database it belongs to — it cannot be replayed into another one.
-   **Verified before indexed**: replicas check signatures, payload shape, database binding and the write policy for every entry they ingest; forged tree metadata and hostile tree shapes are rejected.
-   **Consensus rules in the manifest**: deterministic [json-logic](https://jsonlogic.com/) rules signed into the database — presets `creator-only` (default), `public`, `prefix-per-writer`, `namespace-per-writer`, identity allowlists, or your own rules over the signer, key and operation (put / delete). See [docs/policies.md](docs/policies.md).
-   **Efficient replication**: peers announce one head CID and Merkle-diff their trees, fetching only what differs.
-   **Deterministic conflicts**: last-write-wins on `(timestamp, entry CID)`; signed tombstones for deletes.
-   **Private values**: a value encrypted to one or more identities replicates like any record, but only the recipients can read it; envelopes are bound to their database, key and writer.
-   **Restart durability**: the last head is persisted and re-validated on open, so a node recovers its own state without a live peer.
-   **A node and applications**: `denkmitd` keeps a machine a peer with no application open; the first application, `denkmit-mcp`, gives AI agents shared memory, with a separate identity per agent.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## 🤔 Why

Parties that share facts — findings, decisions, configuration, task state — keep
running into the same question: *"who claimed this, and can I check it without
trusting whoever runs the database?"* Usually someone has to run the database,
and everyone else has to trust them.

DenkMitDB's answer is structural. Every record is signed and bound to its
database; every replica checks the signature, the binding and the database's
signed write rules **before** indexing anything; and provenance is a query
(`provenance(key)`). With `namespace-per-writer` every party — the creator
included — owns exactly its own namespace, so nobody can overwrite or delete
anyone else's facts. None of it needs a server.

It is deliberately narrow: for one owner, SQLite or Postgres is simpler; for
collaborative documents, use Yjs or Automerge. A signature proves which key
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

## 🤖 First application: shared memory for AI agents

The node and the MCP client turn a database into shared memory for agents
from different vendors, on different machines and networks.

```
 Claude Code ─stdio─┐
 Codex ──────stdio──┼─► denkmit-mcp ─local socket─► denkmitd ◄──peer to peer──► other machines
 Claude Desktop ────┘                               (one per machine)
```

```bash
npm install -g @denkmitdb/node @denkmitdb/mcp
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
agents, what others can see, and troubleshooting. Reference: the node and its
settings in [node/README.md](node/README.md), the agent tools in
[mcp/README.md](mcp/README.md).

> Plain notes are readable by everyone who has the memory — the rules limit who
> *writes*. Encrypt what must stay private.

## 🧭 How it compares

Signing records is not unique, and neither is peer-to-peer replication. What
DenkMitDB combines: every record carries its writer's signature and can be
checked again by any later replica; the write rules are a small program signed
into the database's address and enforced by every copy; no operator is
required; and the first application packages it for AI agents.

Closest relatives — several have stronger designs in some respect:

| Project | What it is | Difference from DenkMitDB |
|---|---|---|
| [OrbitDB](https://github.com/orbitdb/orbitdb) | Databases on IPFS from signed logs; an access controller decides each entry | Same stack and lineage; rules come from an access controller rather than a versioned, language-neutral rule program |
| [Willow](https://willowprotocol.org) / Meadowcap | Protocol of authorised entries with capability-based access (data model spec final) | Capabilities can be delegated; ours are fixed at creation until delegation ships |
| [p2panda](https://p2panda.org) | Rust building blocks for local-first apps: signed append-only logs, sync, access control | A toolkit rather than one database with a manifest |
| [Keyhive](https://www.inkandswitch.com/keyhive/) | Ink & Switch's access control and encryption for Automerge | Research stage; rich CRDT merges where we have last-writer-wins |
| [Jazz](https://jazz.tools) | Signed collaborative values with group permissions | Syncs through servers |
| [x0x](https://github.com/saorsa-labs/x0x) and [Constellate](https://github.com/nkoteskey/Constellate) | Agent-oriented replicated stores over gossip, with per-store write policies (owner, allowlist, append-only, own namespace) and per-agent quotas; Constellate is an MCP server for a public commons on x0x | The closest in intent. Immutable keys and quotas are things our rules can't express yet; we haven't confirmed that their records stay checkable by any later replica |

Agent-memory servers such as basic-memory, mem0, Zep or Letta solve a different
problem: one owner's memory, with search and summaries. I found no per-entry
signatures in them. They can sit beside DenkMitDB: the memory server for one
person's notes, DenkMitDB for what several parties share.

This list is surely incomplete — [tell us what we missed](https://github.com/denkmitdb/denkmitdb/issues).

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

**The platform**

| Document | Contents |
|---|---|
| [API at a glance](#api-at-a-glance) and [docs/api/](docs/api/README.md) | The public API; generated reference (`pnpm docs`) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, the Merkle tree, write/read paths, sync, trust model, deployment |
| [docs/policies.md](docs/policies.md) | Consensus rules: who may write what (presets), which entries are valid, custom rules |
| [specs/ordering.md](specs/ordering.md) | Accepted spec: sort key, last-write-wins, format versioning, entry binding |
| [specs/delegation.md](specs/delegation.md) | Draft: owners delegate scoped, time-bounded write rights to device and agent keys |
| [specs/succession.md](specs/succession.md) | Draft: bounded growth via local GC and signed hand-over to a successor database |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Every verified defect with its fix and test, and the open design concerns |
| [docs/testing.md](docs/testing.md) | How it is tested: unit and wire-format tests, package, MCP/daemon smokes, the live mesh, real agents |

**The first application: agents**

| Document | Contents |
|---|---|
| [docs/quickstart.md](docs/quickstart.md) | Ten minutes from install to agents sharing notes |
| [node/README.md](node/README.md) | The node, `denkmitd`: running it, seeds and WebSockets, per-agent identities, settings, systemd |
| [mcp/README.md](mcp/README.md) | The agent client: tools, connecting Claude Code, Codex and Claude Desktop, private values |

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
pnpm --dir node build && cd mcp && pnpm build && pnpm smoke && pnpm smoke:daemon
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
