# denkmit-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes
[DenkMitDB](https://github.com/denkmitdb/denkmitdb) as **shared, signed,
peer-to-peer agent memory**. Any MCP-capable agent (Claude Code, Codex, …) gets a
key-value memory where every write is signed, replicates to every peer holding a
replica, resolves conflicts deterministically (last-write-wins), and can be traced
back to who wrote it and when.

**New here? Follow the [quick start](../docs/quickstart.md)** — ten minutes from
install to two agents sharing notes, no internals needed. This page is the
reference.

> **Readable by every replica.** Anyone who knows the database address and can
> reach a peer can copy its contents; write rules limit who *writes*, not who
> reads. Encrypt what must stay private (see [Private values](#private-values)).

## Tools

| Tool | Purpose |
|---|---|
| `memory_set` | Store a JSON value under a key (signed, replicated, size-capped); `encryptFor: [<identity CID>, …]` stores it encrypted |
| `memory_get` | Read the current value for a key, with its `writer` and `byThisAgent`; encrypted values are decrypted when this node is a recipient |
| `memory_delete` | Delete a key (signed tombstone; a later set resurrects) |
| `memory_list` | List entries in write order, optional key prefix + limit (reports `truncated`) |
| `memory_provenance` | Who wrote the current record for a key, and when |
| `memory_status` | Database address, identity, access policy and own namespace, peers, listen addresses |

A refused or failed call returns `isError` with `{ "error": { "code": "ACCESS_DENIED", "message": "…" } }`; the codes are the library's (`ACCESS_DENIED`, `VALIDITY_REJECTED`, `INVALID_ARGUMENT`, …), so an agent can tell a refusal from a bad request.

## Two ways to run

```
 Claude Code ─stdio─┐
 Codex ──────stdio──┼─► denkmit-mcp (thin client) ─unix socket─► denkmitd (daemon)
 another agent ─────┘                                              │
                                                  libp2p/Helia node, identity, database,
                                                  fixed port — a peer even with no agent open
```

- **Daemon (recommended).** `denkmitd` is one long-lived P2P node per machine (per
  owner): it holds the identity and the database, listens on a fixed port
  (`4001`), and keeps replicating — and serving data to other peers — while no
  agent is open. Every agent on the machine connects through `denkmit-mcp`, which
  simply pipes its stdio to the daemon's Unix socket; all of them sign with the
  daemon's identity (the owner is the trust boundary, not the agent session).
  The socket is owner-only (`0600`), so no token is needed, and nothing but libp2p
  listens on the network.
- **Embedded mode (one agent session).** With no daemon running, `denkmit-mcp` boots its own
  node for the lifetime of the MCP session, as in earlier versions. Fine for one
  agent on one machine; the node disappears when the agent closes.

`DENKMIT_DAEMON=auto` (default) uses the daemon when its socket answers and falls
back to embedded otherwise; `require` fails instead of falling back; `off` always
runs embedded.

## Setup

Published as [`@denkmitdb/mcp`](https://www.npmjs.com/package/@denkmitdb/mcp).

Requires Node.js 22+ on macOS or Linux.

### 1. Run the daemon

```bash
npm install -g @denkmitdb/mcp                       # provides denkmitd and denkmit-mcp
printf 'Passphrase (typing is hidden): '; stty -echo; read -r DENKMIT_PASSPHRASE; stty echo; echo
export DENKMIT_PASSPHRASE
DENKMIT_ACCESS=namespace-per-writer denkmitd
```

It logs the database address (`created memory database bafy…`), the addresses
other peers can dial (`peers can dial: /ip4/…/p2p/12D3…`) and the socket local
agents use. **Choose the access rule on the first start** — it is signed into the
database for good; without `DENKMIT_ACCESS` the database is `creator-only`, and
no other machine can write to it.

### 2. Connect agents

Agents need no passphrase in daemon mode — the daemon holds the key.
`DENKMIT_DAEMON=require` makes a client fail when the daemon is down instead of
starting a private embedded node.

```bash
claude mcp add denkmit --env DENKMIT_DAEMON=require -- denkmit-mcp
```

```toml
# ~/.codex/config.toml
[mcp_servers.denkmit]
command = "denkmit-mcp"
env = { DENKMIT_DAEMON = "require" }
```

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS) — use absolute paths from `command -v node denkmit-mcp`, since desktop
apps may not see your shell's `PATH`:

```json
{ "mcpServers": { "denkmit": { "command": "/full/path/to/node", "args": ["/full/path/to/denkmit-mcp"], "env": { "DENKMIT_DAEMON": "require" } } } }
```

Without a global install: `npx -y --package=@denkmitdb/mcp denkmit-mcp` (the
package has two commands, so npx needs to be told which one).

Embedded mode instead (no daemon): pass `DENKMIT_IDENTITY` and
`DENKMIT_PASSPHRASE` in the agent's MCP config, e.g.
`claude mcp add denkmit --env DENKMIT_DAEMON=off --env DENKMIT_IDENTITY=claude --env DENKMIT_PASSPHRASE='…' -- denkmit-mcp`
(`DENKMIT_DAEMON=off`, or a running daemon takes precedence).

### 3. Share one memory across machines

Every machine runs its own daemon with its **own identity** (its own
passphrase). One of them creates the database (step 1); the others open it by
its **database address** and dial at least one **peer address** that has it —
two different things, both printed in the first daemon's log:

```bash
# machine B
DENKMIT_DB='bafyrei…'                                # database address from A
DENKMIT_PEERS='/ip4/192.168.1.20/tcp/4001/p2p/12D3Koo…'  # one of A's "peers can dial" addresses
export DENKMIT_DB DENKMIT_PEERS
denkmitd
```

**A seed is just a peer that is always on.** Run a daemon on any machine with a
public address (a small VPS works), set `DENKMIT_ANNOUNCE=/ip4/<public-ip>/tcp/4001`
and `DENKMIT_MDNS=off`, open TCP 4001 in its firewall, and point everyone's
`DENKMIT_PEERS` at it. It has no special authority — it verifies and stores
signed entries like any other replica, and any participant can run one — but it
keeps the data reachable when everybody else is offline, and new peers can join
through it. (Peer discovery by database address over a DHT, and NAT traversal
through libp2p relays, are the next steps; today peers dial each other directly.)

On one machine or LAN, peers also find each other without configuration: mDNS on
the local network, and a file rendezvous for servers that share a
`DENKMIT_DATADIR` root.

> **First join:** the first time a node opens a database by address, a peer holding
> the data must be reachable (the manifest travels over bitswap). After that the
> node persists its own replica and reopens it with no peers online.

> **Write access** is signed into the database when it is created. For parties
> that don't trust each other use `DENKMIT_ACCESS=namespace-per-writer`: every
> identity, the creator included, writes and deletes only under
> `agents/<its-identity-cid>/…` (`memory_status` → `access.ownNamespace`), so nobody
> can overwrite or delete anyone else's facts. Other presets: `creator-only`
> (default), `public`, `prefix-per-writer` (like namespace-per-writer, but the
> creator writes anywhere), `allowlist:<cid>,<cid>`. Custom json-logic rules —
> e.g. "only the creator may delete" — go in a `DENKMIT_POLICY_FILE`; see
> [docs/policies.md](../docs/policies.md).

## Separate identities per agent

By default every agent on a machine signs with the daemon's (device) identity.
With `DENKMIT_AGENTS=claude-code,codex,desktop` in the daemon's environment, the
daemon also holds one identity per agent (keychain name `<device>-<agent>`, same
passphrase) and serves each on its own socket, `denkmitd-<agent>.sock`. An agent
picks its identity with `DENKMIT_AGENT`:

```bash
claude mcp add denkmit --env DENKMIT_AGENT=claude-code -- denkmit-mcp
```

```toml
[mcp_servers.denkmit]
command = "denkmit-mcp"
env = { DENKMIT_AGENT = "codex" }
```

Each agent then has its own key, namespace (`agents/<agent-cid>/…` under the
namespace presets), provenance and decryption: a value encrypted to the codex
identity is readable only through the codex socket. `memory_status` reports the
session's `identity`, its `agent` and the `device`. The main socket keeps serving
the device identity, so existing configurations are unaffected. `DENKMIT_AGENT`
implies `DENKMIT_DAEMON=require`: without a daemon serving that agent the client
fails rather than signing as someone else.

Choosing a socket selects an identity; it does not authenticate the agent —
any process of the same OS user can connect to any socket. Agents that must not
impersonate each other belong to different OS users (see
[the delegation spec](https://github.com/denkmitdb/denkmitdb/pull/17) (§11, draft), which also covers the next
step: owner-signed delegation, so other parties see one owner behind the agent
keys).

## Private values

`memory_set` with `encryptFor` encrypts the value before it is signed and
replicated: one AES-256-GCM body, plus a key wrapped with ECDH-ES for each
recipient identity (the identity CIDs come from another node's `memory_status`
or from `memory_provenance` of one of its facts). This node is added as a
recipient unless `includeSelf: false`; `encryptFor: []` means "only me".

`memory_get` / `memory_list` return such values decrypted with
`encrypted: true, readable: true` when this node is a recipient, and otherwise
`readable: false, value: null` with the list of `recipients` — the ciphertext is
never returned. In daemon mode the recipient is the daemon's identity, so every
agent on that machine can read what is encrypted to it.

Each envelope is bound to where it was published — this database, this key,
this writer — and opens only there: a sealed value that someone copied under
their own key reads as `readable: false` (with a note when this node is a listed
recipient). What stays visible to every replica: the key, the writer, the write
time, the recipients' identity CIDs and the size; the recipient list is the
writer's claim, not proof that each listed identity can decrypt. There is no
forward secrecy or key rotation yet, and a recipient that loses its key loses
access for good — keep the daemon's data directory backed up. The
`DENKMIT_MAX_VALUE_BYTES` cap applies to the stored envelope, i.e. after
encryption (about 1.4× the plaintext plus a little per recipient).

## Configuration

Daemon and embedded mode read the same variables; in daemon mode they belong in
the daemon's environment, and the thin client only uses `DENKMIT_DAEMON`,
`DENKMIT_SOCKET` and `DENKMIT_DATADIR` (to find the socket).

| Env var | Default | Meaning |
|---|---|---|
| `DENKMIT_DAEMON` | `auto` | Client: `auto` (daemon if present, else embedded), `require`, `off` |
| `DENKMIT_AGENT` | — | Client: act as this agent of the daemon (its own socket and identity); implies `require` |
| `DENKMIT_AGENTS` | — | Daemon: comma-separated agent names to hold separate identities for |
| `DENKMIT_SOCKET` | `$DENKMIT_DATADIR/denkmitd.sock` | Daemon socket path |
| `DENKMIT_DATADIR` | `~/.denkmit-mcp` | Root data directory (per-identity subdirs) |
| `DENKMIT_IDENTITY` | `agent` | Identity name (also namespaces the data dir) |
| `DENKMIT_PASSPHRASE` | **required** for the daemon / embedded mode | Encrypts the signing key at rest |
| `DENKMIT_DB` | — | Database address to open; absent → create once and remember |
| `DENKMIT_DB_NAME` | `agent-memory` | Name when creating |
| `DENKMIT_ACCESS` | `creator-only` | Preset for a created database: `creator-only`, `public`, `prefix-per-writer`, `namespace-per-writer`, `allowlist:<cid>,…` (unknown values refuse to start) |
| `DENKMIT_POLICY_FILE` | — | JSON `{ "access"?, "validity"? }`: custom consensus rules (policy definitions) for a created database |
| `DENKMIT_MAX_VALUE_BYTES` | `65536` | Largest value `memory_set` accepts (UTF-8 bytes of its JSON) |
| `DENKMIT_LISTEN` | daemon `/ip4/0.0.0.0/tcp/4001`, embedded random port | Comma-separated libp2p listen multiaddrs |
| `DENKMIT_ANNOUNCE` | — | Multiaddrs to advertise instead (public IP / DNS of a server) |
| `DENKMIT_PEERS` | — | Comma-separated multiaddrs to keep connected: dialed at start and again whenever the connection is lost (sleep, network change, a restarted seed) |
| `DENKMIT_REDIAL_SECONDS` | `30` | How often a `DENKMIT_PEERS` entry that is not connected is dialed again (a drop is retried within seconds) |
| `DENKMIT_MDNS` | on | `off` disables local-network discovery (e.g. on a server) |

State (blocks, identity key, head pointer) persists in the data directory, so a
node's memory survives restarts even with no peers online. Back it up: it holds
the signing key.

## Run the daemon as a service

On Linux with systemd, as your own user (no root needed). Stop a daemon you
started in a terminal first (Ctrl+C) — only one may serve the socket.

```bash
mkdir -p ~/.config/denkmit ~/.config/systemd/user
cp "$(npm root -g)/@denkmitdb/mcp/systemd/denkmitd.env.example" ~/.config/denkmit/denkmitd.env
chmod 600 ~/.config/denkmit/denkmitd.env
"${EDITOR:-nano}" ~/.config/denkmit/denkmitd.env   # set DENKMIT_PASSPHRASE (the same one as before) and the rest
cp "$(npm root -g)/@denkmitdb/mcp/systemd/denkmitd.service" ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now denkmitd
loginctl enable-linger "$USER"                      # keep running without a login session
journalctl --user -u denkmitd -f                    # the database address and dialable addresses
```

The unit starts `/usr/bin/env denkmitd`. If Node comes from nvm or another
private prefix, systemd won't find it: set `ExecStart=` to the absolute paths
from `command -v node denkmitd`, e.g.
`ExecStart=/home/you/.nvm/versions/node/v24.11.0/bin/node /home/you/.nvm/versions/node/v24.11.0/bin/denkmitd`.

## Development

The repo is a pnpm workspace — installing at the root covers `mcp/`:

```bash
pnpm install
cd mcp && pnpm build
pnpm smoke          # embedded server end to end (real MCP client over stdio)
pnpm smoke:daemon   # daemon + thin clients, restart, and two daemons over DENKMIT_PEERS
node dist/smoke-sync.js   # two embedded servers via rendezvous/mdns (timing-sensitive, not in CI)
pnpm demo           # the narrated two-agent demo
```
