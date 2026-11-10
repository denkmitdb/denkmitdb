# Release notes draft: v4.0.0

> Draft for the GitHub release of `v4.0.0` (`@denkmitdb/denkmitdb` 4.0.0,
> `@denkmitdb/node` 0.3.0 and `@denkmitdb/mcp` 0.3.0). The full list is in [CHANGELOG.md](../../CHANGELOG.md).

**DenkMitDB 4.0.0: signed fact exchange between agents that don't trust each
other — peer to peer, no server.** The first release built around that focus: a
small public API, consensus rules, an MCP daemon for agents, and a network that
has been running on four machines in four different situations.

## Highlights

- **Entries are bound to their database**, signature-verified and shape-checked
  before indexing; the November review's integrity fixes (KNOWN_ISSUES #24–#34).
- **Consensus rules** `{ access, validity }`, signed into the manifest: presets
  `creator-only`, `public`, `prefix-per-writer`, `namespace-per-writer`,
  allowlists, or your own rules in **DenkMit Logic 1** — a closed, versioned
  subset of JsonLogic, so other implementations can evaluate it identically.
- **Private values**: encrypted to chosen identities, still signed and
  replicated; envelopes are bound to their database, key and writer.
- **`denkmitd` + thin MCP client**: one daemon per machine holds the keys and
  stays a peer; Claude Code, Codex and Claude Desktop connect through it, each
  with its own identity if you want. Peers stay connected through sleep and
  network changes; agents keep their tools across daemon restarts; seeds can be
  reached over WebSockets on 443 from HTTPS-only networks.
- **A small public API**: `createDatabase` / `openDatabase` → `Database<T>`,
  typed errors with stable codes (`ACCESS_DENIED`, `VALIDITY_REJECTED`, …), and
  nothing internal exported. The wire format is frozen by byte-level fixtures.

## Upgrading from 3.x

This is a breaking release, without compatibility aliases. Databases created
by 3.0.0 stay readable; in a database created by 4.0.0, writes from 3.0.0 nodes
are rejected, so upgrade every writer first. The rename table (3.x → 4.0.0) is
in the CHANGELOG under "Public API".

## Get started

- Agents: [docs/quickstart.md](../quickstart.md) — ten minutes, no internals.
- Library: `npm install @denkmitdb/denkmitdb`, then the README's example.

## Tested

Unit, integration and wire-format tests; the packed package and its public
types; MCP and daemon smokes (restart, two daemons, seed restart, WebSockets
only, per-agent identities); the live four-node mesh; and a round with real
agent sessions on different machines ([docs/testing.md](../testing.md)).
