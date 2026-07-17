# denkmit-mcp

An [MCP](https://modelcontextprotocol.io) stdio server that exposes
[DenkMitDB](https://github.com/denkmitdb/denkmitdb) as **shared, signed,
peer-to-peer agent memory**. Any MCP-capable agent (Claude Code, Codex, …) gets a
key-value memory where every write is signed by the agent's identity, replicates
to other agents holding a replica, resolves conflicts deterministically
(last-write-wins), and can be traced back to who wrote it and when.

## Tools

| Tool | Purpose |
|---|---|
| `memory_set` | Store a JSON value under a key (signed, replicated) |
| `memory_get` | Read the current value for a key |
| `memory_delete` | Delete a key (signed tombstone; a later set resurrects) |
| `memory_list` | List entries in write order, optional key prefix + limit |
| `memory_provenance` | Who wrote the current record for a key, and when |
| `memory_status` | Database address, identity, record count, connected peers |

## Setup

```bash
cd mcp
pnpm install
pnpm build
```

### Claude Code

```bash
claude mcp add denkmit \
  --env DENKMIT_IDENTITY=claude \
  --env DENKMIT_PASSPHRASE='choose-a-secret' \
  -- node /path/to/denkmitdb/mcp/dist/index.js
```

Or in `.mcp.json`:

```json
{
    "mcpServers": {
        "denkmit": {
            "command": "node",
            "args": ["/path/to/denkmitdb/mcp/dist/index.js"],
            "env": {
                "DENKMIT_IDENTITY": "claude",
                "DENKMIT_PASSPHRASE": "choose-a-secret"
            }
        }
    }
}
```

### Sharing memory between agents

Each agent runs its **own** server process with its **own identity** (and its own
data directory — derived automatically from the identity name). To share one
memory:

1. Start the first agent's server; it creates the database and logs its address
   (also visible via `memory_status` → `databaseAddress`).
2. Give every other agent that address via `DENKMIT_DB`, e.g. for Codex:

```toml
# ~/.codex/config.toml
[mcp_servers.denkmit]
command = "node"
args = ["/path/to/denkmitdb/mcp/dist/index.js"]
env = { DENKMIT_IDENTITY = "codex", DENKMIT_PASSPHRASE = "another-secret", DENKMIT_DB = "<address>" }
```

Servers on the same machine that share a `DENKMIT_DATADIR` root find each other
via a **file rendezvous** (each advertises its listen addresses under the data
root and dials its siblings — works even where mdns multicast is blocked); mdns
additionally discovers LAN peers where multicast works, and remote peers can be
dialed explicitly via `DENKMIT_PEERS`.

> **First join:** the first time an agent opens a database by address, a peer
> holding the data must be reachable (the manifest travels over bitswap). After
> that the agent persists its own replica and reopens it with no peers online.

> **Write access:** databases are **creator-only by default** — other agents can
> read/replicate but their writes are rejected. For a fleet where every agent
> writes, create the database with `DENKMIT_PUBLIC_WRITE=true` (any identity may
> write; provenance still attributes every record to its writer).

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `DENKMIT_DATADIR` | `~/.denkmit-mcp` | Root data directory (per-identity subdirs) |
| `DENKMIT_IDENTITY` | `agent` | Identity name (also namespaces the data dir) |
| `DENKMIT_PASSPHRASE` | insecure dev default | Encrypts the signing key at rest — set it |
| `DENKMIT_DB` | — | Database address to open; absent → create once and remember |
| `DENKMIT_DB_NAME` | `agent-memory` | Name when creating |
| `DENKMIT_PUBLIC_WRITE` | `false` | Created database accepts writes from any identity |
| `DENKMIT_PEERS` | — | Comma-separated multiaddrs to dial |

State (blocks, identity key, head pointer) persists in the data directory, so an
agent's memory survives restarts even with no peers online.

## Notes

- Prototype status: local stdio for personal/team use. If this graduates to
  distribution, the sanctioned path is an MCPB bundle (runtime included).
- `pnpm smoke` runs an end-to-end test (real MCP client over stdio against a
  throwaway data directory); `node dist/smoke-sync.js` runs a two-agent
  replication test (two server processes, rendezvous discovery, bidirectional
  sync with provenance) — kept out of CI because it exercises timing-sensitive
  peer discovery.
