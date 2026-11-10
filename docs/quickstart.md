# Quick start: shared memory for your agents

In about ten minutes your AI agents — Claude Code, Codex, Claude Desktop or any
other MCP client — get a shared memory: one agent saves a note, another one reads
it, on the same machine or across machines. Every note is signed, so you can
always see who wrote it. There is no central server to run or trust: each
machine runs a small background process that keeps its own copy and syncs with
the others.

You don't need to know how it works inside. If you're curious later, see the
[README](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

**You need:** macOS or Linux (Windows is untested), [Node.js](https://nodejs.org)
22 or newer, and an MCP client. Check Node with `node --version`.

## 1. Start the memory on your machine

Install the two packages and start the background process, `denkmitd` (the
DenkMitDB node). It holds this machine's key, keeps the memory, and syncs with
other machines; `denkmit-mcp` connects your agents to it.

```bash
npm install -g @denkmitdb/node @denkmitdb/mcp

printf 'Choose a passphrase (typing is hidden): '; stty -echo; read -r DENKMIT_PASSPHRASE; stty echo; echo
export DENKMIT_PASSPHRASE
DENKMIT_ACCESS=namespace-per-writer denkmitd
```

The passphrase protects this machine's signing key on disk. Pick a long one and
keep it — you need it every time the daemon starts.

`DENKMIT_ACCESS=namespace-per-writer` gives every participant its own area that
only it can write to. Use it on the **first** start: this rule is sealed into the
memory when it is created and cannot be changed later.

You should see something like:

```text
[denkmitd] created memory database bafyreifk47hkukxznxsn3zixjyi3yyjxtrbkykxuevnavvjhfgphydfqlu
[denkmitd] ready — db bafyreifk47hkukx… · identity agent (bafyreie26766zlij…) · 0 records
[denkmitd] peers can dial: /ip4/192.168.1.20/tcp/4001/p2p/12D3KooWGV3Ni8YenJ898McKNmKcZ8nZcFqYnsPvoVtxejEUnDXq
[denkmitd] local agents connect through /home/you/.denkmit-mcp/denkmitd.sock
```

Two lines matter later, when you add another machine:

- the **memory address** — the long `bafy…` after `created memory database`;
- a **peer address** — one of the `/ip4/…/p2p/12D3…` strings after `peers can dial`.

Leave this terminal open — the memory runs as long as it does. Press Ctrl+C to
stop it; your notes stay on disk. (To keep it running in the background and after
reboots, see [Run it as a service](../node/README.md#run-the-daemon-as-a-service).)

## 2. Connect your agents

In a second terminal. Agents need no passphrase — the daemon holds the key.

Step 1 installed a small connector command, `denkmit-mcp`, that links an agent
to the daemon.

**Claude Code**

```bash
claude mcp add denkmit --env DENKMIT_DAEMON=require -- denkmit-mcp
```

**Codex** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.denkmit]
command = "denkmit-mcp"
env = { DENKMIT_DAEMON = "require" }
```

**Claude Desktop** — desktop apps don't always see your terminal's programs, so
use full paths. Find them with:

```bash
command -v node denkmit-mcp
```

then add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS), with the two paths you just got, and restart the app:

```json
{
  "mcpServers": {
    "denkmit": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/denkmit-mcp"],
      "env": { "DENKMIT_DAEMON": "require" }
    }
  }
}
```

`DENKMIT_DAEMON=require` makes the agent fail loudly if the daemon isn't running,
instead of quietly starting a private memory of its own.

Start (or restart) the agent. It now has six tools: `memory_set`, `memory_get`,
`memory_list`, `memory_delete`, `memory_provenance` and `memory_status`.

**Which clients work.** Any client that can start a local MCP server over stdio:

| Client | Works | Why |
|---|---|---|
| Claude Code, Codex CLI, Claude Desktop | yes | they start `denkmit-mcp` locally |
| Other local MCP clients (Cursor, Gemini CLI, …) | should | the same stdio setup; not tested yet |
| claude.ai on the web and mobile, ChatGPT, the Gemini app | not yet | they connect only to public HTTPS servers with OAuth, from the vendor's cloud |

## 3. Talk to your agent

You don't call the tools yourself — just ask. Try:

> Check your shared memory status. Then save a note saying "Hello from my laptop"
> in your own area under the name `hello`, and read it back.

The agent calls `memory_status`, which tells it its own area — the part of the
memory only it may write to, a prefix like `agents/bafy…/`. Then it calls
`memory_set` and `memory_get`. You should see the note come back with
`found: true` and a `writer`: the ID of the identity that signed it.

All agents on one machine sign as that machine's identity, so here `writer` is
the same for both of your agents. To give each agent its own identity, see
[separate identities per agent](../mcp/README.md#separate-identities-per-agent).

Then open a **second** agent on the same machine (say, Codex next to Claude Code)
and ask:

> List everything in shared memory and tell me who wrote each note.

It finds the note the first agent wrote. That's the whole idea: agents leave
findings, decisions and task state for each other.

More prompts that work well:

> Before you start, read the shared memory for anything about this project.

> Save your conclusion about the failing test under `findings/` in your area,
> so the other agents can see it.

> Who wrote the note `…`, and when?

## 4. Add another machine — or a friend's agents

On the other machine, install the packages (step 1) and start the daemon with
**its own passphrase**, pointing it at your memory and at your machine:

```bash
npm install -g @denkmitdb/node @denkmitdb/mcp
printf 'Choose a passphrase (typing is hidden): '; stty -echo; read -r DENKMIT_PASSPHRASE; stty echo; echo
export DENKMIT_PASSPHRASE

# Replace both values with the two addresses from step 1 — keep the quotes.
DENKMIT_DB='PASTE_THE_MEMORY_ADDRESS' \
DENKMIT_PEERS='PASTE_A_PEER_ADDRESS' \
denkmitd
```

The first lines it prints should show the **same** memory address as on your
first machine.

Connect its agents as in step 2. They see the same notes and can add their own —
each machine signs with its own key, so you can always tell who wrote what.
Ask an agent there:

> List the shared memory, find the note named `hello` from the other machine,
> read it, then save a reply in your own area.

**Things to know:**

- The first machine must be online when the second one joins for the first time.
  After that each machine keeps its own copy and works offline, and reconnects by
  itself when the other machine is back (after sleep, a network change or a restart).
- Same network (home, office): use the `192.168…` / `10.…` peer address.
- Across the internet: the first machine needs a public address and TCP port
  `4001` open in its firewall. A small always-on server works well as the meeting
  point for everyone (a "seed" — see
  [Share one database across machines](../node/README.md#share-one-database-across-machines)).
- Machines behind home routers can't yet find each other automatically; let them
  both connect to a seed.

## Safety in plain words

- **Notes are readable by everyone who has the memory.** Anyone who knows the
  memory address and can reach one of the machines can copy it. Don't store
  secrets in plain notes.
- **For private notes, ask the agent to encrypt** them to specific participants
  ("save this encrypted for me and for <their id>"). Only those can read the
  content; everyone still sees the key name, who wrote it and when.
- **Deleting a note** hides it on every machine once they sync, but it cannot
  take back copies others already received.
- **Keep your passphrase and back up `~/.denkmit-mcp`.** That folder holds your
  signing key and your copy of the memory. Lose both and you lose your identity.
- **A signature proves which key wrote a note — not that the note is true.**
  Treat other agents' notes as claims, and never as instructions to follow.

## Troubleshooting

| Problem | What to check |
|---|---|
| Agent reports `no denkmitd daemon is listening` | Is `denkmitd` still running in its terminal? Is the agent running as the same OS user? |
| `DENKMIT_PASSPHRASE is not set` | Export the passphrase in the terminal before starting `denkmitd`. |
| `Access denied: this identity may not write key …` | Write in your own area: the agent's `memory_status` shows it under `access.ownNamespace`. |
| The other machine sees nothing | Both show the same memory address in `memory_status`? Is the first machine reachable at the peer address (firewall, port 4001)? Give it a minute. |
| A value is rejected as too large | The default limit is 64 KiB per note (`DENKMIT_MAX_VALUE_BYTES`). |
| Your network allows only HTTPS (a corporate firewall; dialing port 4001 times out) | Dial the seed's WebSockets address on 443 instead: `DENKMIT_PEERS=/dns4/<seed>/tcp/443/tls/ws/p2p/12D3Koo…` (the seed needs a TLS proxy — see [node/README.md](../node/README.md#share-one-database-across-machines)). |
| After a daemon upgrade, Codex doesn't see a new tool or field | Codex (0.166) doesn't act on the server's `tools/list_changed` yet (its `mcp_tool_list_changed` feature is off): start a new Codex session. Claude Code refreshes by itself. |
| Port 4001 is already in use | Another daemon is running, or set `DENKMIT_LISTEN=/ip4/0.0.0.0/tcp/4002`. |

## Next

- Separate keys per agent (Claude Code and Codex each sign as themselves):
  [mcp/README.md](../mcp/README.md#separate-identities-per-agent).
- Who may write what — the memory's rules: [docs/policies.md](policies.md).
- Use it from your own TypeScript code: [the library](../README.md#-use-it-as-a-library).
