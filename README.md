# 🧰 DenkMitDB

<!-- all-shields/header-badges:START -->

[![v1.0.0](https://img.shields.io/badge/version-v1.0.0-lightgray.svg?style=flat&logo=)](https://github.com/denkmitdb/denkmitdb/blob/main/CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat&logo=license)](https://github.com/denkmitdb/denkmitdb/blob/main/LICENSE) [![Language: TypeScript](https://img.shields.io/badge/language-typescript-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)

<!-- all-shields/header-badges:END -->

[![CI](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml/badge.svg)](https://github.com/denkmitdb/denkmitdb/actions/workflows/ci.yml)

DenkMitDB is a distributed key-value database built on IPFS ([Helia](https://github.com/ipfs/helia)), using a Merkle tree as the consistency controller. Every record is a signed, content-addressed block; replicas converge by broadcasting a single root CID over gossipsub and diffing Merkle trees to fetch only what they are missing.

> ⚠️ **Status: experimental.** The write-validation ("consensus") rule installed by
> default accepts every write and the access controller is not implemented yet, so a
> database is writable by anyone who knows its address. Record deletion is planned
> but not implemented. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) and
> [ROADMAP.md](ROADMAP.md) before using this in anything real.

## 🎁 Support: Donate

> This project is **free**, **open source** and I try to provide excellent **free support**. Why donate? I work on this project several hours in my spare time and try to keep it up to date and working. **THANK YOU!**

<!-- all-shields/sponsors-badges:START -->

[![Donate Bitcoin](https://img.shields.io/badge/BTC-1MGfAyH2K9Y6RJXmxbr52nwWeG59Xz2Aje-E38B29.svg?style=flat-square&logo=bitcoin)]()

<!-- all-shields/sponsors-badges:END -->

## 💡 Features

-   **Distributed storage**: all state lives in IPFS as signed, content-addressed dag-cbor blocks.
-   **Efficient replication**: peers exchange one head CID and Merkle-diff their trees, so sync cost scales with the difference, not the database size.
-   **Signed writes**: every entry is a JWS tied to a self-certifying identity (its CID).
-   **Write validation**: a [json-logic](https://jsonlogic.com/) rule stored in the database manifest is evaluated for every local and merged write.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

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
    import { gossipsub } from "@chainsafe/libp2p-gossipsub";
    import { noise } from "@chainsafe/libp2p-noise";
    import { yamux } from "@chainsafe/libp2p-yamux";
    import { identify } from "@libp2p/identify";
    import { tcp } from "@libp2p/tcp";
    import { createHelia } from "helia";
    import { createLibp2p } from "libp2p";
    import { createDenkmitDatabase, createIdentity } from "@denkmitdb/denkmitdb";
    ```

2. **Initialize libp2p & Helia**:

    ```typescript
    const libp2pOptions = {
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
        transports: [tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        services: {
            identify: identify(),
            pubsub: gossipsub({ emitSelf: true }),
        },
    };

    const libp2p = await createLibp2p(libp2pOptions);
    const helia = await createHelia({ libp2p });
    ```

3. **Create new Database Identity and new Database**:

    ```typescript
    const identity = await createIdentity("user", "password", helia);

    const db = await createDenkmitDatabase("test", { helia, identity });
    console.log("Database address: ", db.id);
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
6. **Close Database**
    ```typescript
    await db.close();
    await helia.stop();
    ```

## 📚 Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data model, the pollard Merkle tree, write/read paths, sync protocol, trust model |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Verified bugs (several pinned by failing tests) and open design concerns |
| [ROADMAP.md](ROADMAP.md) | Where the project is going: spec → correctness → upgrades → features → v2.0.0 |
| [specs/ordering.md](specs/ordering.md) | Accepted v2 spec: composite sort key, last-write-wins, format versioning |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CODEX_REVIEW.md](CODEX_REVIEW.md) | Independent adversarial review of the Phase 0 safety net (July 2026) |
| [docs/](docs/README.md) | Generated API reference (typedoc) |

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

-   Tests marked `it.fails` document known bugs (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)); when you fix one, flip its test to a normal `it`.
-   CI runs lint, typecheck, build, tests, and the package smoke test on Node 20 and 22 for every push and pull request.

## 👨‍💻 Contributing

We welcome contributions! Please fork the repository and submit pull requests. For major changes, please open an issue to discuss what you would like to change. Good starting points are the items in [KNOWN_ISSUES.md](KNOWN_ISSUES.md) with test pins.

## 💫 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🦄 Contact

For more information, please contact the project maintainer at [askar@zhakenov.pro](mailto:askar@zhakenov.pro).
