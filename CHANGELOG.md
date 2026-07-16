# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
