# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Phase 0.5 — honest safety net (after independent adversarial review)

An independent Codex review (`CODEX_REVIEW.md`) of Phase 0 found the published
package unloadable and several guarantees overstated. Fixed:

- **ESM output now loads**: switched to `NodeNext` module resolution with explicit
  `.js` specifiers and relative (instead of bare `src/…`) imports. The v1.0.0
  package entry point could never be imported (`ERR_MODULE_NOT_FOUND`).
- **Types entry fixed**: `types` now points at `dist/functions/index.d.ts` (the
  runtime entry). Removed 16 phantom `export declare function` statements from
  `src/types/*` — including `addEntry`/`getEntry`, which never existed — and with
  them a `types → functions` circular dependency. Added missing `size` and
  `sendHead` to `DenkmitDatabaseInterface` (caught by the new typecheck).
- **Runtime works outside vitest**: `node-datachannel` (native, unused WebRTC
  transitive dep) is now stubbed repo-wide via `pnpm.overrides` instead of a
  test-only vitest alias, so `import("helia")`, the README quickstart and the
  examples work under plain `node`. Consumers of the published package remain
  exposed until the helia upgrade (see ROADMAP.md Phase 3).
- **CI now proves packagability**: new `pnpm test:package` packs the tarball,
  verifies entry points, imports the packed code and exercises it; new
  `pnpm typecheck` covers tests/configs; lint extended beyond `src/`; actions
  bumped to v5 with minimal token permissions and PR concurrency cancellation.
- **Tests hardened**: `database.test.ts` no longer order-dependent (each case owns
  its database), iteration order asserted as ordered tuples, the LWW pin now checks
  timestamp + CID + creator, the pollard order-8 contract discrepancy is pinned,
  and the factory-installed consensus rule is tested (not a hand-built copy).
- **Docs corrected**: ARCHITECTURE.md no longer claims pollards are signed or that
  merge verifies entries — the trust model now documents the real gap
  (KNOWN_ISSUES.md #10/#11); KNOWN_ISSUES.md gained ten review-found issues;
  ROADMAP.md reordered — correctness before runtime-major upgrades, access control
  before delete.

### Phase 0 — safety net

Phase 0 of [ROADMAP.md](ROADMAP.md): safety net. No runtime behaviour changes.

### Added
- Test suite (vitest): 49 tests across unit suites (leaf, pollard, sorted index,
  identity, consensus) and integration suites (single-node database, two-node
  replication over TCP). Known bugs are pinned with `it.fails` and cross-referenced
  to KNOWN_ISSUES.md.
- GitHub Actions CI: lint, build, and test on Node 20.x and 22.x.
- Documentation: `ARCHITECTURE.md` (data model, Merkle "pollard" tree, sync
  protocol, trust model), `KNOWN_ISSUES.md` (9 verified bugs + design concerns),
  `ROADMAP.md` (Phases 1–4), this changelog.
- `pnpm.neverBuiltDependencies`: skip the native build of `node-datachannel`
  (WebRTC transitive dependency; the transport is never used).

### Changed
- `main` fast-forwarded to include the previously unmerged `consensus` branch
  (v1 consensus controller, leaf/sync fixes).
- README: removed the unimplemented record-deletion claim, fixed broken badge
  links, documented development workflow.

### Removed
- Unused runtime dependencies: `@faker-js/faker`, `inquirer`, `@inquirer/confirm`,
  `@inquirer/input`, `@inquirer/prompts`, `blockstore-fs`, `datastore-fs`,
  `@helia/unixfs`, `@libp2p/bootstrap`, `@libp2p/keychain`, `@libp2p/mdns`,
  `@libp2p/interfaces` (deprecated).

## [1.0.0] — 2024-06-23

Initial release: distributed key-value database on IPFS/Helia with Merkle-tree
(pollard) consistency, JWS-signed entries, json-logic write validation, and
gossipsub-based head announcement. Includes the `consensus` branch work
(v1 consensus controller) that reached `main` in July 2026.
