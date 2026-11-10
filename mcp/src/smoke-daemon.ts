/**
 * Daemon smoke test: starts a real `denkmitd`, connects two thin `denkmit-mcp`
 * clients to it (no passphrase — the daemon holds the key), and checks that they
 * share one node, identity and database; that the socket is owner-only; that a
 * second daemon on the same socket refuses to start; that a restarted daemon still
 * has the data; and that DENKMIT_DAEMON=require fails without a daemon.
 *
 * Run: `pnpm build && pnpm smoke:daemon`.
 */
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "denkmit-daemon-"));
const socket = join(dataDir, "denkmitd.sock");
const daemonEnv = {
    ...process.env,
    DENKMIT_DATADIR: dataDir,
    DENKMIT_IDENTITY: "owner",
    DENKMIT_PASSPHRASE: "daemon-smoke-secret",
    DENKMIT_ACCESS: "namespace-per-writer",
    DENKMIT_LISTEN: "/ip4/127.0.0.1/tcp/0", // never collide with a real daemon on 4001
};

function assert(cond: unknown, message: string): asserts cond {
    if (!cond) throw new Error(`DAEMON SMOKE FAIL: ${message}`);
}

function firstText(result: unknown): unknown {
    const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
    const block = content?.find((c) => c.type === "text");
    assert(block?.text, "tool returned no text content");
    return JSON.parse(block.text);
}

function startDaemon(env: NodeJS.ProcessEnv = daemonEnv): ChildProcess {
    return spawn(process.execPath, [join(here, "daemon.js")], { env, stdio: ["ignore", "ignore", "pipe"] });
}

function exitCode(child: ChildProcess, timeoutMs = 30_000): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("process did not exit")), timeoutMs);
        child.once("exit", (code) => {
            clearTimeout(timer);
            resolve(code);
        });
    });
}

async function waitForSocket(path = socket, timeoutMs = 60_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const ok = await new Promise<boolean>((resolve) => {
            const probe = connect(path);
            probe.once("connect", () => {
                probe.destroy();
                resolve(true);
            });
            probe.once("error", () => resolve(false));
        });
        if (ok) return;
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("DAEMON SMOKE FAIL: daemon socket never came up");
}

async function client(name: string, dir = dataDir, agent?: string) {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(here, "index.js")],
        // Deliberately no DENKMIT_PASSPHRASE: in daemon mode the client holds no key.
        env: {
            PATH: process.env.PATH ?? "",
            DENKMIT_DATADIR: dir,
            DENKMIT_DAEMON: "require",
            ...(agent ? { DENKMIT_AGENT: agent } : {}),
        },
        stderr: "pipe",
    });
    const c = new Client({ name: `daemon-smoke-${name}`, version: "0.0.0" });
    await c.connect(transport);
    return c;
}

type Status = { databaseAddress: string; identity: { cid: string }; access: { policy: string; ownNamespace: string } };

/**
 * Two daemons standing in for two machines: separate data directories and
 * identities, mDNS off, and the only link is DENKMIT_PEERS pointing at the
 * first daemon's fixed port — exactly how a laptop joins a seed on a server.
 */
async function twoMachines(): Promise<void> {
    const seedDir = mkdtempSync(join(tmpdir(), "denkmit-seed-"));
    const peerDir = mkdtempSync(join(tmpdir(), "denkmit-peer-"));
    const port = 40_000 + Math.floor(Math.random() * 20_000);
    const base = { ...process.env, DENKMIT_MDNS: "off", DENKMIT_ACCESS: "namespace-per-writer" };
    const seedEnv = {
        ...base,
        DENKMIT_DATADIR: seedDir,
        DENKMIT_IDENTITY: "seed-owner",
        DENKMIT_PASSPHRASE: "seed-secret",
        DENKMIT_LISTEN: `/ip4/127.0.0.1/tcp/${port}`,
    };
    let seed = startDaemon(seedEnv);
    let peer: ChildProcess | undefined;
    try {
        await waitForSocket(join(seedDir, "denkmitd.sock"));
        const onSeed = await client("seed", seedDir);
        const seedStatus = firstText(await onSeed.callTool({ name: "memory_status", arguments: {} })) as Status;
        await onSeed.callTool({
            name: "memory_set",
            arguments: { key: `${seedStatus.access.ownNamespace}decision`, value: { by: "seed" } },
        });

        peer = startDaemon({
            ...base,
            DENKMIT_DATADIR: peerDir,
            DENKMIT_IDENTITY: "laptop-owner",
            DENKMIT_PASSPHRASE: "laptop-secret",
            DENKMIT_LISTEN: "/ip4/127.0.0.1/tcp/0",
            DENKMIT_DB: seedStatus.databaseAddress,
            DENKMIT_PEERS: `/ip4/127.0.0.1/tcp/${port}`,
            DENKMIT_REDIAL_SECONDS: "1",
        });
        await waitForSocket(join(peerDir, "denkmitd.sock"));
        const onPeer = await client("laptop", peerDir);
        const peerStatus = firstText(await onPeer.callTool({ name: "memory_status", arguments: {} })) as Status;
        assert(peerStatus.databaseAddress === seedStatus.databaseAddress, "the peer must open the seed's database");
        assert(peerStatus.identity.cid !== seedStatus.identity.cid, "the two machines must have distinct identities");

        const waitFor = async (what: string, c: Client, key: string) => {
            const started = Date.now();
            while (Date.now() - started < 60_000) {
                const got = firstText(await c.callTool({ name: "memory_get", arguments: { key } })) as {
                    found: boolean;
                };
                if (got.found) return;
                await new Promise((r) => setTimeout(r, 500));
            }
            throw new Error(`DAEMON SMOKE FAIL: timed out waiting for ${what}`);
        };
        await waitFor("the seed's fact on the peer", onPeer, `${seedStatus.access.ownNamespace}decision`);
        const finding = `${peerStatus.access.ownNamespace}finding`;
        await onPeer.callTool({ name: "memory_set", arguments: { key: finding, value: { by: "laptop" } } });
        await waitFor("the peer's fact on the seed", onSeed, finding);
        const prov = firstText(await onSeed.callTool({ name: "memory_provenance", arguments: { key: finding } })) as {
            writer: string;
        };
        assert(prov.writer === peerStatus.identity.cid, "the seed must attribute the fact to the peer's identity");

        // Encrypted values across machines: one sealed to the peer only, one to the seed only.
        const forPeer = `${seedStatus.access.ownNamespace}for-laptop`;
        const forSeed = `${seedStatus.access.ownNamespace}seed-only`;
        await onSeed.callTool({
            name: "memory_set",
            arguments: {
                key: forPeer,
                value: { token: "laptop" },
                encryptFor: [peerStatus.identity.cid],
                includeSelf: false,
            },
        });
        await onSeed.callTool({
            name: "memory_set",
            arguments: { key: forSeed, value: { token: "seed" }, encryptFor: [] },
        });
        await waitFor("the encrypted facts on the peer", onPeer, forSeed);
        await waitFor("the encrypted facts on the peer", onPeer, forPeer);
        type Read = {
            encrypted?: boolean;
            readable?: boolean;
            value: { token?: string } | null;
            recipients?: string[];
        };
        const read = async (c: Client, key: string) =>
            firstText(await c.callTool({ name: "memory_get", arguments: { key } })) as Read;
        const peerReadsOwn = await read(onPeer, forPeer);
        assert(peerReadsOwn.readable && peerReadsOwn.value?.token === "laptop", "the recipient must decrypt its value");
        const peerReadsSeeds = await read(onPeer, forSeed);
        assert(
            peerReadsSeeds.encrypted && !peerReadsSeeds.readable && peerReadsSeeds.value === null,
            "a non-recipient must see the record but not its content",
        );
        assert(peerReadsSeeds.recipients?.[0] === seedStatus.identity.cid, "recipients must be listed");
        const seedReadsPeers = await read(onSeed, forPeer);
        assert(!seedReadsPeers.readable, "includeSelf: false must keep the writer out too");
        console.log("encrypted values: recipients read them, everyone else sees only key, writer and recipients");

        // The seed restarts on the same address. It does not know the peer, so only the
        // peer can restore the connection: it must redial on its own.
        await onSeed.close();
        seed.kill("SIGTERM");
        await exitCode(seed);
        seed = startDaemon(seedEnv);
        await waitForSocket(join(seedDir, "denkmitd.sock"));
        const onSeedAgain = await client("seed-again", seedDir);
        const afterRestart = `${seedStatus.access.ownNamespace}after-restart`;
        await onSeedAgain.callTool({ name: "memory_set", arguments: { key: afterRestart, value: { by: "seed" } } });
        await waitFor("a fact written after the seed restarted, on the peer", onPeer, afterRestart);
        console.log("the peer redials a restarted seed by itself (DENKMIT_PEERS stays connected)");
        await onSeedAgain.close();
        await onPeer.close();
        console.log("two daemons (separate machines, mDNS off) replicate both ways via DENKMIT_PEERS");
    } finally {
        for (const child of [peer, seed]) {
            if (child && child.exitCode === null) {
                child.kill("SIGTERM");
                await exitCode(child).catch(() => child.kill("SIGKILL"));
            }
        }
        rmSync(seedDir, { recursive: true, force: true });
        rmSync(peerDir, { recursive: true, force: true });
    }
}

/**
 * A seed reachable only over WebSockets (as behind a TLS reverse proxy on 443,
 * for networks that block other ports): the peer dials its /ws address.
 */
async function overWebSockets(): Promise<void> {
    const seedDir = mkdtempSync(join(tmpdir(), "denkmit-ws-seed-"));
    const peerDir = mkdtempSync(join(tmpdir(), "denkmit-ws-peer-"));
    const port = 40_000 + Math.floor(Math.random() * 20_000);
    const base = { ...process.env, DENKMIT_MDNS: "off", DENKMIT_ACCESS: "namespace-per-writer" };
    const seed = startDaemon({
        ...base,
        DENKMIT_DATADIR: seedDir,
        DENKMIT_IDENTITY: "ws-seed",
        DENKMIT_PASSPHRASE: "ws-seed-secret",
        DENKMIT_LISTEN: `/ip4/127.0.0.1/tcp/${port}/ws`,
    });
    let peer: ChildProcess | undefined;
    try {
        await waitForSocket(join(seedDir, "denkmitd.sock"));
        const onSeed = await client("ws-seed", seedDir);
        const seedStatus = firstText(await onSeed.callTool({ name: "memory_status", arguments: {} })) as Status & {
            listenAddresses: string[];
        };
        assert(
            seedStatus.listenAddresses.some((a) => a.includes("/ws")),
            `the seed must listen on WebSockets (got ${seedStatus.listenAddresses.join(", ")})`,
        );
        const fact = `${seedStatus.access.ownNamespace}over-ws`;
        await onSeed.callTool({ name: "memory_set", arguments: { key: fact, value: { via: "websockets" } } });

        peer = startDaemon({
            ...base,
            DENKMIT_DATADIR: peerDir,
            DENKMIT_IDENTITY: "ws-peer",
            DENKMIT_PASSPHRASE: "ws-peer-secret",
            DENKMIT_LISTEN: "/ip4/127.0.0.1/tcp/0",
            DENKMIT_DB: seedStatus.databaseAddress,
            DENKMIT_PEERS: `/ip4/127.0.0.1/tcp/${port}/ws`,
        });
        await waitForSocket(join(peerDir, "denkmitd.sock"));
        const onPeer = await client("ws-peer", peerDir);
        const started = Date.now();
        let found = false;
        while (!found && Date.now() - started < 60_000) {
            found = (firstText(await onPeer.callTool({ name: "memory_get", arguments: { key: fact } })) as { found: boolean })
                .found;
            if (!found) await new Promise((r) => setTimeout(r, 500));
        }
        assert(found, "the peer must replicate from a seed reachable only over WebSockets");
        await onSeed.close();
        await onPeer.close();
        console.log("a seed reachable only over WebSockets replicates (the /wss-behind-443 path)");
    } finally {
        for (const child of [peer, seed]) {
            if (child && child.exitCode === null) {
                child.kill("SIGTERM");
                await exitCode(child).catch(() => child.kill("SIGKILL"));
            }
        }
        rmSync(seedDir, { recursive: true, force: true });
        rmSync(peerDir, { recursive: true, force: true });
    }
}

/**
 * DENKMIT_AGENTS: one daemon, separate identities per agent. Each agent signs,
 * reads and decrypts as itself through its own socket; the main socket stays the
 * device identity.
 */
async function agentIdentities(): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), "denkmit-agents-"));
    const daemon = startDaemon({
        ...process.env,
        DENKMIT_DATADIR: dir,
        DENKMIT_IDENTITY: "box",
        DENKMIT_PASSPHRASE: "agents-secret",
        DENKMIT_ACCESS: "namespace-per-writer",
        DENKMIT_LISTEN: "/ip4/127.0.0.1/tcp/0",
        DENKMIT_MDNS: "off",
        DENKMIT_AGENTS: "claude-code,codex",
    });
    try {
        await waitForSocket(join(dir, "denkmitd.sock"));
        await waitForSocket(join(dir, "denkmitd-codex.sock"));
        const device = await client("device", dir);
        const claude = await client("claude", dir, "claude-code");
        const codex = await client("codex", dir, "codex");
        type S = Status & { agent: string | null; device: { cid: string }; identity: { cid: string; name: string } };
        const status = async (c: Client) => firstText(await c.callTool({ name: "memory_status", arguments: {} })) as S;
        const [sd, sc, sx] = [await status(device), await status(claude), await status(codex)];
        assert(
            sd.agent === null && sc.agent === "claude-code" && sx.agent === "codex",
            "sessions must report their agent",
        );
        assert(new Set([sd.identity.cid, sc.identity.cid, sx.identity.cid]).size === 3, "three distinct identities");
        assert(sc.device.cid === sd.identity.cid && sx.device.cid === sd.identity.cid, "agents report their device");
        assert(sx.identity.name === "box-codex", "agent identity name is <device>-<agent>");

        const fact = `${sx.access.ownNamespace}fact`;
        await codex.callTool({ name: "memory_set", arguments: { key: fact, value: { by: "codex" } } });
        const prov = firstText(await claude.callTool({ name: "memory_provenance", arguments: { key: fact } })) as {
            writer: string;
            byThisAgent: boolean;
        };
        assert(
            prov.writer === sx.identity.cid && !prov.byThisAgent,
            "the fact is attributed to codex, not claude-code",
        );
        const intrude = await claude.callTool({ name: "memory_set", arguments: { key: `${fact}2`, value: 1 } });
        assert((intrude as { isError?: boolean }).isError, "claude-code must not write into codex's namespace");

        const secret = `${sc.access.ownNamespace}for-codex`;
        await claude.callTool({
            name: "memory_set",
            arguments: { key: secret, value: { token: "x" }, encryptFor: [sx.identity.cid], includeSelf: false },
        });
        type Read = { readable?: boolean; value: { token?: string } | null };
        const read = async (c: Client) =>
            firstText(await c.callTool({ name: "memory_get", arguments: { key: secret } })) as Read;
        assert((await read(codex)).value?.token === "x", "codex decrypts what was sealed to codex");
        assert(!(await read(device)).readable, "the device identity is not a recipient");
        assert(!(await read(claude)).readable, "includeSelf: false keeps the writing agent out");

        const ghost = spawn(process.execPath, [join(here, "index.js")], {
            env: { PATH: process.env.PATH ?? "", DENKMIT_DATADIR: dir, DENKMIT_AGENT: "ghost" },
            stdio: ["pipe", "ignore", "ignore"],
        });
        assert((await exitCode(ghost)) === 1, "an unknown agent must fail instead of falling back");
        for (const c of [device, claude, codex]) await c.close();
        console.log("agent identities: separate keys, namespaces, provenance and decryption per agent");
    } finally {
        if (daemon.exitCode === null) {
            daemon.kill("SIGTERM");
            await exitCode(daemon).catch(() => daemon.kill("SIGKILL"));
        }
        rmSync(dir, { recursive: true, force: true });
    }
}

let daemon = startDaemon();
try {
    await waitForSocket();
    assert((statSync(socket).mode & 0o777) === 0o600, "socket must be owner-only (0600)");

    const a = await client("a");
    const b = await client("b");
    const statusA = firstText(await a.callTool({ name: "memory_status", arguments: {} })) as Status;
    const statusB = firstText(await b.callTool({ name: "memory_status", arguments: {} })) as Status;
    assert(statusA.databaseAddress === statusB.databaseAddress, "both clients must see one database");
    assert(statusA.identity.cid === statusB.identity.cid, "both clients must share the daemon's identity");
    assert(statusA.access.policy === "denkmit-access-namespace-per-writer", "daemon created the wrong preset");
    console.log("two thin clients share one node, identity and database");

    const key = `${statusA.access.ownNamespace}fact`;
    await a.callTool({ name: "memory_set", arguments: { key, value: { from: "a" } } });
    const seen = firstText(await b.callTool({ name: "memory_get", arguments: { key } })) as { found: boolean };
    assert(seen.found, "b must read a's write immediately (same node)");
    const outside = await a.callTool({ name: "memory_set", arguments: { key: "shared/x", value: 1 } });
    assert((outside as { isError?: boolean }).isError, "namespace-per-writer must refuse writes outside the namespace");
    const outsideError = (firstText(outside) as { error: { code: string } }).error;
    assert(outsideError.code === "ACCESS_DENIED", `outside the namespace: expected ACCESS_DENIED, got ${outsideError.code}`);
    await a.close();
    const still = firstText(await b.callTool({ name: "memory_get", arguments: { key } })) as { found: boolean };
    assert(still.found, "closing one client must not affect another");
    console.log("writes are shared; closing one client leaves the others working");

    const second = startDaemon();
    assert((await exitCode(second)) === 1, "a second daemon on the same socket must refuse to start");
    console.log("a second daemon refuses to start");

    // b stays open across the restart: the thin client must reconnect and
    // re-initialize the session by itself, so the agent keeps its tools, and tell
    // the agent to refetch the tool list (a newer daemon may have changed it).
    let toolsChanged = false;
    b.setNotificationHandler(ToolListChangedNotificationSchema, () => {
        toolsChanged = true;
    });
    daemon.kill("SIGTERM");
    assert((await exitCode(daemon)) === 0, "daemon must shut down cleanly");
    daemon = startDaemon();
    await waitForSocket();
    const survived = firstText(await b.callTool({ name: "memory_get", arguments: { key } })) as { found: boolean };
    assert(survived.found, "a client open across a daemon restart must keep working (thin client reconnects)");
    assert(toolsChanged, "after reconnecting, the thin client must send notifications/tools/list_changed");
    await b.close();
    console.log("an agent's client survives a daemon restart (reconnect + session replay)");
    const c = await client("c");
    const after = firstText(await c.callTool({ name: "memory_get", arguments: { key } })) as {
        found: boolean;
        value: { from: string };
    };
    assert(after.found && after.value.from === "a", "a restarted daemon must still have the data");
    await c.close();
    console.log("a restarted daemon keeps the data");

    daemon.kill("SIGTERM");
    await exitCode(daemon);
    const orphan = spawn(process.execPath, [join(here, "index.js")], {
        env: { PATH: process.env.PATH ?? "", DENKMIT_DATADIR: dataDir, DENKMIT_DAEMON: "require" },
        stdio: ["pipe", "ignore", "ignore"],
    });
    assert((await exitCode(orphan)) === 1, "DENKMIT_DAEMON=require must fail without a daemon");
    console.log("DENKMIT_DAEMON=require fails without a daemon");

    await twoMachines();
    await overWebSockets();
    await agentIdentities();
    console.log("MCP DAEMON SMOKE TEST PASSED");
} finally {
    if (daemon.exitCode === null) daemon.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
}
