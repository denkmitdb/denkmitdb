# Testing

Four layers, from fastest to most real. CI runs the first three on every push;
the last two run against real machines before a release.

## 1. Unit and integration tests — `pnpm test`

vitest suites in `test/`: the database, policies and the policy language,
identities, encryption, the Merkle tree, sorted index, adversarial and
integrity cases (forged leaves, replayed entries, hostile tree shapes), typed
error codes, and two-node replication over real libp2p/TCP
(`*.integration.test.ts`). Every fix in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) has a
regression test that fails on the code before the fix.

`test/wire` freezes the wire format: exact payload bytes and CIDs, and real
signed blocks captured from earlier code that must still decode and open. If it
fails, the change altered bytes on the wire — fix the code, never the fixture.

## 2. Package — `pnpm test:package`

Packs the tarball, asserts the runtime exports equal the public API exactly
(an internal leaking out fails like a missing name), and typechecks a small
consumer against the packed declarations.

## 3. MCP server and daemon — `cd mcp && pnpm smoke && pnpm smoke:daemon`

Real MCP clients over stdio against real processes:

- `smoke`: the embedded server end to end, value size cap, encryption, tombstones,
  `writtenAt`.
- `smoke:daemon`: the daemon and thin clients — shared writes, a second daemon
  refused, restart persistence, a client that stays open across a daemon restart
  (reconnect, session replay, `tools/list_changed`), two daemons standing in for
  two machines (mDNS off, `DENKMIT_PEERS` only), the peer redialing a restarted
  seed, a seed reachable only over WebSockets, encrypted values across machines,
  and per-agent identities.
- `node dist/smoke-sync.js`: two embedded servers via mDNS/rendezvous
  (timing-sensitive, not in CI). `pnpm demo` narrates a two-agent scenario.

## 4. The live mesh — `scripts/e2e-mesh.mjs`

Runs against real, already running nodes over SSH, through each node's daemon
and installed thin client — the path an agent's MCP client takes:

```bash
cp scripts/e2e-mesh.example.json ~/e2e-nodes.json    # edit: your nodes
node scripts/e2e-mesh.mjs ~/e2e-nodes.json --restart <a node>
```

All nodes in parallel: each writes a note, a secret encrypted to the next node in
a ring, and a deleted note, and tries to write into the next node's area; then
every node reads every other node's notes. It checks provenance, the signed
`writtenAt`, tombstones, that each secret is readable exactly by its writer and
recipient, `ACCESS_DENIED`, and (with `--restart`) that an open client survives a
daemon restart. It writes only under each node's own `agents/<cid>/e2e/<run>/`.
Exit code 0 means every check passed.

## 5. Real agents — a release check by hand

Before a release, run one round with real agent sessions on different machines
(e.g. Claude Code behind a corporate firewall over 443, Codex on a server),
giving each the same steps in plain language and letting it use only its
`memory_*` tools: status, its own note, a note encrypted to the other agent, a
write and delete, a write into the other's area (expect `ACCESS_DENIED`), and
reading the other agent's notes with provenance. Compare the reports, then verify
from a third node.

This layer found what the others could not: agents losing their tools when the
daemon restarted (#27), stale tool schemas after an upgrade (#33), and agents
inventing timestamps because the signed time was not returned (#34).
