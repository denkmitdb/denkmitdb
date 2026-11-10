# denkmitd — the DenkMitDB node

`@denkmitdb/node` runs a long-lived [DenkMitDB](https://github.com/denkmitdb/denkmitdb)
peer: one process per machine (per owner) that holds the identities and the
database, listens on a fixed libp2p port (`4001`), and keeps replicating — and
serving data to other peers — while no application is open. An always-on node is a
**seed**; it has no special authority.

Local applications talk to the node over owner-only Unix sockets (`0600`). The
node's local API speaks the [Model Context Protocol](https://modelcontextprotocol.io):
the tools are listed in [`@denkmitdb/mcp`](../mcp/README.md#tools), whose
`denkmit-mcp` thin client connects AI agents (Claude Code, Codex, Claude Desktop)
to it. Nothing but libp2p listens on the network.

> **Readable by every replica.** Anyone who knows the database address and can
> reach a peer can copy its contents; write rules limit who *writes*, not who
> reads. Encrypt what must stay private
> ([private values](../mcp/README.md#private-values)).

Published as [`@denkmitdb/node`](https://www.npmjs.com/package/@denkmitdb/node).
Requires Node.js 22+ on macOS or Linux.

## Run a node

```bash
npm install -g @denkmitdb/node                      # provides denkmitd
printf 'Passphrase (typing is hidden): '; stty -echo; read -r DENKMIT_PASSPHRASE; stty echo; echo
export DENKMIT_PASSPHRASE
DENKMIT_ACCESS=namespace-per-writer denkmitd
```

It logs the database address (`created memory database bafy…`), the addresses
other peers can dial (`peers can dial: /ip4/…/p2p/12D3…`) and the socket local
clients use. **Choose the access rule on the first start** — it is signed into the
database for good; without `DENKMIT_ACCESS` the database is `creator-only`, and
no other machine can write to it.

## Share one database across machines

Every machine runs its own daemon with its **own identity** (its own
passphrase). One of them creates the database ([above](#run-a-node)); the others open it by
its **database address** and dial at least one **peer address** that has it —
two different things, both printed in the first daemon's log:

```bash
## Separate identities per agent

With `DENKMIT_AGENTS=claude-code,codex,desktop` in the daemon's environment, the
node also holds one identity per agent (keychain name `<device>-<agent>`, same
passphrase) and serves each on its own socket, `denkmitd-<agent>.sock`; the main
socket keeps serving the device identity. A client picks an identity by the socket
it connects to (`DENKMIT_AGENT` in [`denkmit-mcp`](../mcp/README.md#separate-identities-per-agent)).

Choosing a socket selects an identity; it does not authenticate the client —
any process of the same OS user can connect to any socket. Clients that must not
impersonate each other belong to different OS users (see
[the delegation spec](../specs/delegation.md#11-daemon-sessions-and-local-isolation), §11, draft).

## Configuration

`denkmitd` reads its configuration from the environment (for the service, from
`~/.config/denkmit/denkmitd.env`). The same variables configure the embedded mode of
[`denkmit-mcp`](../mcp/README.md); the client-only ones are marked.

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
| `DENKMIT_LISTEN` | daemon `/ip4/0.0.0.0/tcp/4001`, embedded random port | Comma-separated libp2p listen multiaddrs: TCP, or WebSockets (`…/tcp/4002/ws`, e.g. behind a TLS proxy) |
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
cp "$(npm root -g)/@denkmitdb/node/systemd/denkmitd.env.example" ~/.config/denkmit/denkmitd.env
chmod 600 ~/.config/denkmit/denkmitd.env
"${EDITOR:-nano}" ~/.config/denkmit/denkmitd.env   # set DENKMIT_PASSPHRASE (the same one as before) and the rest
cp "$(npm root -g)/@denkmitdb/node/systemd/denkmitd.service" ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now denkmitd
loginctl enable-linger "$USER"                      # keep running without a login session
journalctl --user -u denkmitd -f                    # the database address and dialable addresses
```

The unit starts `/usr/bin/env denkmitd`. If Node comes from nvm or another
private prefix, systemd won't find it: set `ExecStart=` to the absolute paths
from `command -v node denkmitd`, e.g.
`ExecStart=/home/you/.nvm/versions/node/v24.11.0/bin/node /home/you/.nvm/versions/node/v24.11.0/bin/denkmitd`.

## Development

The repo is a pnpm workspace; the MCP client's smoke tests exercise the node:

```bash
pnpm install && pnpm build          # the library
pnpm --dir node build               # denkmitd
pnpm --dir mcp build && pnpm --dir mcp smoke:daemon   # node + thin clients, restart, two nodes
```
