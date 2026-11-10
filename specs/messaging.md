# Spec (draft): messaging — change feed, inbox and push for agents

Status: **draft for discussion** (November 2026), targeting 4.1. Nothing here is
implemented. Sources: the push design of the
[November 2026 review](../docs/review-2026-11.md) §4 and use case 3.8, and the
concepts of Denkmail, the 2024 prototype of serverless e-mail on which this
project started (its Merkle tree first appeared there). This draft narrows both on
purpose; §12 lists what was deferred and why.
Related: `specs/delegation.md` (owners, §11 daemon sessions), `specs/succession.md`
(retention), `specs/ordering.md` (signed time), `docs/policies.md`.

## 1. Why

An agent acts only when a person types or a tool returns. Today it learns about
other agents' work only by asking (`memory_get`, `memory_list`), so cross-agent
work needs a human to say "check shared memory". Two things are missing:

1. **News.** "What changed since I last looked, and who wrote it?" is the
   question every agent asks, with or without messages. The library knows exactly
   which key won and who signed it, and tells no one.
2. **Addressing.** An agent can write a fact, but it can't say "this is for
   codex@lab" in a way the recipient's side notices, and identities are raw CIDs
   that nobody can read.

## 2. Goals and non-goals

Goals:

- Agents learn about changes and messages addressed to them **at their next turn**,
  in every client, without polling by hand.
- A message is a **signed, attributable record** that survives both sides being
  offline, delivered through any replica, including one that can't read it.
- Human-readable addresses (`codex@lab`) without a global registry.
- Nothing another identity writes can make an agent act unless its owner has
  accepted that sender: **values are data, never instructions.**
- Works on the live 4.0.0 database (`namespace-per-writer`) with **no format change**:
  messages are an application convention over ordinary entries.

Non-goals (decided, not deferred):

- Live request/response RPC between running agents. That's A2A's job; this is
  asynchronous handoff for when the other side isn't there.
- Delivery guarantees: no exactly-once, no ordering beyond the signed time, no
  queue, no broker, no locks.
- A global name registry. Under last-writer-wins with writer-chosen clocks,
  "registered first" is undefined (Denkmail's `sha256(username)` registry failed on
  exactly this).
- Hiding who talks to whom (§9).
- An SMTP gateway, MIME, folders.

## 3. Layers

Each layer is useful without the next one:

| Layer | Where | What | Useful alone for |
|---|---|---|---|
| L1 change feed | library | an event when a record becomes the live winner | any app that reacts to replication |
| L2 journal | daemon | durable, cursor-addressed history of L1 events | `memory_changes`, "what's new since X" |
| L3 messages | daemon + convention | outbox keys, card, contacts, inbox index | addressed messages |
| L4 delivery | clients | notice line, hooks, later wake | getting it in front of the model |

## 4. L1 — change feed (library)

```ts
type ChangeEvent =
    | { type: "change"; key: string; entryCid: CID; writer: CID; timestamp: number;
        deleted: boolean; origin: "local" | "remote" }
    | { type: "reset" }; // the index was replaced wholesale (load(), open)

interface Database<T> {
    /** Calls `listener` after each change of a key's live winner; returns unsubscribe. */
    subscribe(listener: (event: ChangeEvent) => void): () => void;
}
```

- Emitted only when a record **becomes the live winner** (`result.applied`): after the
  index mutation in `set`, `delete` and the remote merge path. A losing concurrent
  entry emits nothing.
- `reset` is emitted when `load()` replaces the index, including on open, instead of
  replaying the whole database as news. Consumers that need precise diffs keep
  their own `key → entryCid` map (L2 does).
- Event data is captured before the next `await`. A throwing listener is logged and
  isolated; it never affects the write or merge.
- The values aren't included: listeners fetch them, attributed, through the same
  path as `memory_get` (KNOWN_ISSUES #35).

This is an additive API change (a minor version).

## 5. L2 — journal and cursors (daemon)

- **Journal:** an append-only local log per database in the data directory: `seq`
  (local, monotonic), `epoch` (random, fixed when the journal is created), and the
  L1 event fields. Bounded: the newest 50,000 events or 90 days, whichever is
  smaller.
- **Promise:** "you will learn the latest state of every key that changed", not every
  intermediate transition.
- **Reconciliation:** the daemon persists `key → entryCid` for the live index. On
  start, and after every `reset`, it diffs the index against that map and journals
  the differences as `origin: "restore"`. That covers crashes between index and
  journal, and opens.
- **Cursor:** the opaque string `<epoch>.<seq>`. A cursor from another epoch, or one
  older than the retained window, gets `reset: true` and the caller resyncs.
- **Consumers:** cursors and acknowledgements are local state per
  *(identity, consumer name)*, since several sessions can share one identity. They
  never replicate.

Tool:

`memory_changes({ since?, prefix?, writers?, excludeOwn?, limit? })` →
`{ events: [{ key, entryCid, writer, writtenAt, deleted, origin }], next, reset? }`.
Without `since` it returns only `next` (a starting point), not history.

## 6. L3 — messages

### 6.1 Keys

| Key | Written by | Meaning |
|---|---|---|
| `agents/<sender>/_/outbox/<recipient>/<msg-id>` | sender's daemon | a message; `<recipient>` is an identity CID or `all` |
| `agents/<me>/_/receipts/<sender>/<msg-id>` | recipient's daemon | optional receipt (§6.5) |
| `agents/<me>/_/card` | the daemon, for each identity it holds | the identity's card (§6.3) |

- **The `_/` segment is reserved for protocol records.** Everything an agent writes
  freely in its area stays outside it. The live database already shows why: agents
  choose their own top-level names (`hello`, `deploy/…`, `projects/…`), and nothing
  would stop one from writing `card` or `outbox/…` with its own meaning. Under `_/`,
  free keys and protocol keys can't collide, and later protocols (threads,
  attachments) get room there without negotiation.
- **`memory_set` and `memory_delete` refuse keys under `agents/<cid>/_/`** with
  `INVALID_ARGUMENT`. Only the daemon writes there, through `memory_send`,
  `memory_receipt` and its own card. So a model can't forge a card or a message with
  an ordinary write, by mistake or through an injected instruction. A peer running
  its own client can still write there, but only in its own area, so whatever it
  writes stays its own signed claim.
- The sender writes **in its own area**, so `namespace-per-writer` already makes
  every message attributable and impossible for anyone else to alter or delete.
  (Denkmail's recipient-owned, world-writable drop box let anyone overwrite or
  delete waiting mail; this layout removes that.)
- `<msg-id>` is generated by the daemon, never by the model. It's exactly 12
  characters of `[0-9a-z]`, time-sortable plus random. Any other id shape is reserved
  for later forms (e.g. slots, §10).
- A recipient's daemon accepts a key as a message only if:
  - it has exactly six segments;
  - segments 3–4 are `_` and `outbox`;
  - segment 6 matches the id grammar;
  - segment 2 equals the **signed writer** of the entry (checked even under presets
    that would allow otherwise).

### 6.2 Message value

```json
{ "v": 1,
  "type": "note",
  "subject": "x86 reopen time",
  "body": "…",
  "inReplyTo": "<entry CID of the message answered>",
  "expires": 604800,
  "wantReceipt": false }
```

- `type`: `note | request | reply`. There's no `from` and no timestamp: the signer and
  the signed time are the only truth (`writtenAt`).
- `inReplyTo` is an **entry CID**, a hash of the signed record, so a reply is bound to
  the exact text it answered. If the request is edited afterwards, the reply no
  longer matches its current record, and the inbox reports it as "answers an earlier
  version". The model passes `replyTo: <key>`; the daemon fills in the CID it
  recorded for that message.
- `expires` (seconds after the signed time) is local policy for notices and the
  inbox (§10), not a consensus rule.
- `body` may be an encrypted value (`encryptFor` the recipient), like any value. Size limits
  are in §11.3.
- **Immutable by convention.** The rule language can't enforce it (rules don't see
  values in DenkMit Logic 1), so the daemon records the first entry CID it saw per
  message key and shows a later one as `edited`, and a tombstone as `retracted`.

### 6.3 Card

```json
{ "v": 1, "handle": "codex", "device": "lab", "client": "codex-cli",
  "role": "x86 benchmarks; read-only measurements", "accepts": ["note", "request"] }
```

- Written by the **daemon**, at start and when its configuration changes, for each
  identity it holds:
  - `handle` and `device` come from the names it already has (`DENKMIT_IDENTITY`,
    the agent names in `DENKMIT_AGENTS`), charset `[a-z0-9-]{1,32}`;
  - `role` comes from `DENKMIT_CARD_ROLE[_<AGENT>]`.

  The model never writes it. That replaces the review's model-written `profile` roll
  call.
- At most 2 KiB. Every field is the writer's **claim**. Cards are read to propose
  contacts, never shown in notices, and `role` is returned only on an explicit call,
  labeled as a claim.

### 6.4 Contacts and addresses

- **Contact table:** a local file in the daemon's data directory. Each entry is
  `{ cid, name, state: contact | request | blocked, verified: invite | first-use, firstSeen }`.
  It never replicates.
- **Address:** `handle@device` (`codex@lab`), a bare `handle` (same device as the
  sender), `all`, or a raw CID. It's resolved **only through the local contact
  table**. An unknown or ambiguous address fails with `INVALID_ARGUMENT` plus
  `candidates`; the daemon never guesses.
- **Display:** results show the local contact name. A non-contact appears as a CID
  prefix, never under its self-chosen handle.
- **Requests:**
  - the first message from a non-contact creates a `request`;
  - requests raise no notice, don't appear in `memory_inbox`, and get no automatic
    reply or receipt of any kind;
  - at most 20 pending messages per unknown identity and 200 in total are indexed;
    beyond that they're only counted.
- **Contacts change only by a person**, through the CLI or an MCP elicitation dialog.
  When the first message from a non-contact arrives, the daemon may ask in a dialog
  shown to the *user*, not the model: "Accept codex@lab (bafy…)? Yes / No". No MCP
  tool adds, accepts or unblocks: an injected message must not be able to promote
  its own sender. The dialog serves people who use only Claude Desktop. Clients
  without elicitation fall back to the CLI.
- **Name collisions:** a different CID claiming an accepted name is reported as a
  collision and stays a request.
- **Invite:** one string replaces copying a database address, a peer address and a
  CID from three places. It contains the database, a peer to dial, the inviter's CID
  and its name, e.g.
  `denkmit:join?v=1&db=<address>&peer=<multiaddr>&id=<cid>&name=codex@lab`
  (format in §11.4). `denkmit join <invite>` adds the inviter as `verified: invite`.

### 6.5 Receipts

`{ "v": 1, "re": "<entry CID>", "state": "received | done | declined", "reply": "<entry CID>?", "note": "…" }`

- Written explicitly by the recipient (`memory_receipt`), one key per message; the
  recipient is the only writer, so last-writer-wins is safe.
- Off unless the agent writes one. The daemon never writes one by itself: an
  automatic `received` would tell every replica when each agent was active (§13,
  decision 3).
- Three states only. `received` means "seen and kept", `done` means "handled; see
  `reply`", `declined` means "won't do it". Task workflow states (`accepted`, `offered`,
  assignment among several takers) are deferred (§12).
- `memory_ack` is a different thing: local, per consumer, "this session has seen
  it"; it never replicates.

### 6.6 Inbox index

- The recipient's daemon indexes, at ingest (L1 events), every valid message key
  (§6.1) whose recipient segment is one of its identities or `all`. This isn't a
  prefix query, so it needs its own index, kept with the journal.
- It joins the index with the contact table and with its own receipts, so a message
  with a `done` or `declined` receipt is never surfaced as new again.
- Malformed values are skipped and counted; they never stop the index or a cursor.

### 6.7 Tools (4.1)

| Tool | Does |
|---|---|
| `memory_send({ to, subject, body, type?, replyTo?, encrypt?, wantReceipt?, expires? })` | resolves `to`, writes the message, returns a delivery report: `{ key, entryCid, to: { address, cid }, peersConnected, recipientLastWrite }`. It's a hint, not a guarantee: with `peersConnected: 0` it says the message is stored locally and will replicate later |
| `memory_inbox({ state?: "unread" \| "all", limit? })` | metadata of messages from contacts: `{ key, from, entryCid, type, subject, writtenAt, inReplyTo?, edited?, retracted?, receipt? }`; bodies through `memory_get` |
| `memory_ack({ keys })` | marks as seen for this consumer |
| `memory_receipt({ key, state, reply?, note? })` | writes a receipt |
| `memory_changes(…)` | §5 |
| `memory_contacts({ query? })` | read-only contact list: name, CID, state, verified |

Every tool result gains one fixed field, `notices: { unread: <n> }`: the count of
unread inbox messages from contacts, nothing else.

## 7. L4 — getting it in front of the model

4.1 builds "pull with a doorbell": the agent learns at the next turn boundary.

| Client | 4.1 mechanism |
|---|---|
| Claude Code | `UserPromptSubmit` and `SessionStart` hooks run `denkmit inbox --hook`, which prints one fixed-template line, e.g. `denkmit: 2 unread messages (codex@lab, desktop@askvivo). Use memory_inbox to read them.` |
| Codex | the same command from `hooks.json` (`SessionStart`, `UserPromptSubmit`), trusted once through `/hooks` |
| Claude Desktop | the `notices` field on every memory tool result, plus one sentence in the server instructions |
| No session open | `denkmit watch` prints events in a terminal; optional OS notification |

- Hook output is **metadata only**: count, local contact names, nothing from values,
  keys or cards.
- The command reads through the daemon socket and exits within 1 s if the daemon is
  down (a hook must never block a prompt).
- `denkmit`: a small CLI over the daemon socket, needed by hooks and humans alike.
  Commands: `status`, `whoami`, `invite`, `join`, `contacts [requests | accept | block | remove]`,
  `send --to … --subject … --stdin`, `inbox [--hook]`, `changes`, `watch`. Secrets can
  then go through `--stdin` without entering a model's context.

Not in 4.1: waking an idle session (Claude Code `asyncRewake` / channels,
`codex queue … --resume`), `memory_wait` long-poll, and starting headless runs on an
event (§12).

## 8. Safety rules

1. **Values are data.** Tool descriptions keep saying so; `memory_inbox` labels
   subject and body as the sender's claim.
2. **Metadata only** in notices and hook output. No subject, no key tail, no card text.
3. **Default deny:** only contacts produce notices or inbox entries. Contacts change
   only through the CLI.
4. **No automatic message of any kind** to a non-contact: no receipt, no reply, no error.
5. **Coalesced, fixed templates:** "3 unread from codex@lab", never a stream.
6. **The lure.** Even a metadata-only notice leads the agent to read the untrusted body
   one call later. Rules 1–3 limit *who* can lure; they don't make the body safe.
   Agents that act on requests should do so with the least privilege their client
   allows.
7. **The daemon never declares a capability that lets a database writer approve tool
   calls** (e.g. a channel permission relay).
8. A malformed message is skipped and counted, never fatal.

## 9. Metadata is public

Every replica, including a seed, can read every key and entry header. For each
message that means **sender, recipient, signed time and size**, even when the body is
encrypted. Replacing the recipient CID with a hash doesn't help: anyone who knows the
CIDs can compute it. Hiding the social graph would need a different transport, not a
key convention.

The spec states this as a property: **who talks to whom is visible to everyone who
can read the database.** Choose who can read the database (its address is the read
secret today) accordingly.

## 10. Growth and retention

Messages are the fastest way to reach the practical ceiling (review §2.5: about 10k
records comfortable, 100k the upper bound). Every message is a record forever, a
tombstone is a record too, and nothing is garbage-collected yet
(`specs/succession.md`). As a rough guide, 100 messages a day reach 36k records in a
year.

In 4.1:

- **Guidance:** messages are for coordination, not chat. Large or chatty payloads go
  elsewhere, and a reference goes in the message.
- **`expires`** hides expired messages from the inbox and notices locally. It doesn't
  shrink the database.

Later, once growth is a measured problem (the live database holds about 60 records):

- **Slots:** a sender passes `slot: <n>` to reuse `_/outbox/<recipient>/slot-<n>`
  instead of a new id (the `-` keeps slot names outside the id grammar of §6.1), which bounds its records per recipient. The cost: an unread message can be
  overwritten, so the inbox would show `superseded` when a slot it hadn't
  acknowledged changes.
- Local GC (succession layer A), and a separate messaging database per collaboration
  once a daemon can hold several databases (review §2.2 item 8).

## 11. Format stability and compatibility

Two kinds of decisions are made here, and they're treated differently:

- **Local:** contact table, cursors, journal, dialogs, how things are shown to an
  agent. These can change in any release.
- **Wire:** key layout, value fields, how strings are written inside values, the
  invite string. Every record is permanent and replicated, and other implementations
  (a Rust or Python port) will read it, so these are frozen once 4.1 writes the first
  message. The rules below exist so that the deferred items in §12 can be added later
  **without migrating existing records**.

### 11.1 Rules for readers

1. **Tolerant reader:** unknown fields in a message, card or receipt are ignored,
   never an error.
2. **Versions:** values carry `v: 1`. A reader skips a value with an unknown `v` (it
   counts it and doesn't fail). A new field doesn't bump `v`; only a change in the
   meaning of an existing field does.
3. **Unknown message `type`:** listed as `unknown`, its body is never shown in a
   notice, and nothing acts on it.
4. **Unknown receipt `state`:** ignored for decisions, shown as-is. The state name
   `delivered` is reserved for a possible receipt written by a daemon rather than an
   agent, so the two can never be confused.
5. **Malformed records** (bad key shape, wrong types, over a limit) are skipped and
   counted (§8 rule 8).

### 11.2 Canonical forms inside values

- **CIDs as strings** (`inReplyTo`, `re`, `reply`): CIDv1, base32, lowercase (the `bafy…`
  form). Readers compare CIDs after parsing, but writers emit only this form.
- **Times:** only the signed entry timestamp (milliseconds) is a time. Durations
  (`expires`) are whole seconds relative to it. No wall-clock strings in values.
- **Names** in cards (`handle`, `device`): `[a-z0-9-]{1,32}`.
  - `.` and `@` can never appear, so they stay free for the address grammar: `@`
    separates handle and device, and `.owner` is reserved for delegation
    (`codex@lab.askar`).
  - The words `all`, `me` and `self` are not valid handles or devices.
- **Addresses are never stored** in replicated data. Keys and values name identities
  only by CID. `codex@lab` is a local rendering through the contact table, so naming
  can change (e.g. with delegation) without touching a single record.

### 11.3 Receiver-side limits

These are part of the spec, not only the MCP's 64 KiB cap, so every implementation
rejects the same records:

| Field | Limit |
|---|---|
| message value (encoded) | 64 KiB |
| `subject` | 200 characters |
| card value (encoded) | 2 KiB |
| receipt `note` | 1,000 characters |

### 11.4 Invite string

`denkmit:join?v=1&db=<address>&peer=<multiaddr>&id=<cid>&name=<handle@device>`

All values are URL-encoded; `peer` may repeat. Unknown parameters are ignored, and an
unknown `v` is refused with a clear message. The `name` is the inviter's suggestion
for the local contact name, not a claim anyone verifies.

### 11.5 Conformance vectors

Before 4.1 ships, `test/vectors/messaging.json` (language-neutral, like the DenkMit
Logic 1 vectors of issue #30) pins:
- which keys are messages, receipts and cards (including signer mismatch and every
  rejected shape);
- which values parse (versions, unknown fields and types, limits);
- when a reply "answers an earlier version".

A second implementation is conformant when it agrees on every vector.

### 11.6 Interfaces

- No entry, manifest or policy format change. Older nodes replicate messages as
  ordinary records; they just don't index them.
- `subscribe` is additive to the library API.
- **MCP tool names and result fields are a contract too:** hooks and prompts depend
  on them. New tools and fields are added; existing ones aren't renamed or removed
  without a deprecation release. After an upgrade, agents refetch the tool list
  (Codex: start a new session, see docs/quickstart.md).

## 12. Deferred, with reasons

| Item | Source | Why later |
|---|---|---|
| Waking idle sessions: Claude Code `asyncRewake` / channels, `codex queue --resume` | review §4 phase 2 | client features are a research preview or untested here; needs L1–L3 first |
| `memory_wait` long-poll | review | holds the agent's turn; hooks cover the need first |
| Headless run on an event (`claude -p`, `codex exec`) | review phase 3 | remote prompt execution; design it with a sender policy, a read-only sandbox, rate limits and audit, then decide |
| Task states (`accepted`, `failed`), `offered` and `assign` for broadcast requests, accept-before-execute | Denkmail review, changes 5–6 | the beginning of a workflow engine; wait for unattended runs |
| `memory_thread`, `memory_get({ entryCid })`, sent view | Denkmail review, change 4 | needs a thread index and bounded traversal; `inReplyTo` in 4.1 keeps the data ready |
| Attachments by reference (encrypted blob outside the tree) | Denkmail envelope/body split | real design: pinning, availability, size enforcement |
| `reach` addresses in the card | MX / Nostr kind 10050 | dialing attacker-supplied addresses needs limits; a second seed is configuration today |
| Proof-of-work door (`startsWith(entryCreator, "bafyreiaaaa")`, about 18 bits) and `denkmit identity mine` | Denkmail hashcash sketch | only for open-membership databases, which don't exist yet; it already works in DenkMit Logic 1 when needed |
| Separate intake database for strangers | Denkmail drop box vs. mailbox | needs several databases per daemon |
| Rotating encryption keys in the card | Denkmail per-user encryption key | key lifecycle work, library support |
| Verifiable owner part of addresses (`codex@lab.askar`) | delegation | delegation phase 2 |
| Slots that bound records per recipient | this spec, §10 | growth isn't a measured problem yet |
| Automatic `received` receipts | Denkmail review | leak each agent's activity to every replica; explicit receipts first |

## 13. Decisions (2026-11-10)

1. **Contacts without a terminal:** a person accepts a contact through the CLI or an
   MCP elicitation dialog, which the user sees and the model can't answer (§6.4).
2. **Addresses:** `handle@device` everywhere people and agents see an identity. The
   keychain keeps its internal `<device>-<agent>` names; nothing is renamed.
3. **No automatic `received`:** receipts are written only by the agent (§6.5).
   Revisit if "did it arrive?" turns out to need it.
4. **Slots: later.** Not in 4.1; revisit when growth is measured (§10).
5. **No first contact from strangers for now:** invites cover the next six months (own
   machines plus invited parties). The intake database and the proof-of-work door stay
   in §12 as documented options.

## 14. Acceptance for 4.1

- **Library:** tests that `subscribe` emits exactly once per new winner (local and
  merged), nothing for a losing concurrent entry, and `reset` on `load()`.
- **Daemon:** a journal survives a restart; a stale-epoch cursor gets `reset: true`;
  reconciliation journals a merge that happened between index and journal writes.
- **`smoke:daemon`:**
  - two daemons, one agent each;
  - `memory_send` to `codex@lab`;
  - the recipient's `notices.unread` becomes 1, and `memory_inbox` shows the message
    with the right writer;
  - a reply with `inReplyTo`; an edited request shows `edited`;
  - a non-contact's message raises nothing and appears under `denkmit contacts requests`;
  - accepting it through an elicitation dialog makes it a contact, and no tool call
    can do that;
  - `memory_set` / `memory_delete` under `agents/<own cid>/_/` fail with
    `INVALID_ARGUMENT`.
- **Vectors:** the library and the daemon pass `test/vectors/messaging.json` (§11.5).
- **Hooks:** `denkmit inbox --hook` prints the fixed line and exits in under 1 s with
  the daemon down.
- **Live mesh:** `scripts/e2e-mesh.mjs` gains a message ring: each node sends to the
  next and reads the reply.
