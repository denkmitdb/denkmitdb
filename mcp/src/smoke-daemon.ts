/**
 * Daemon smoke test: starts a real `denkmitd`, connects two thin `denkmit-mcp`
 * clients to it (no passphrase — the daemon holds the key), and checks that they
 * share one node, identity and database; that the socket is owner-only; that a
 * second daemon on the same socket refuses to start; that a restarted daemon still
 * has the data; and that DENKMIT_DAEMON=require fails without a daemon.
 *
 * Run: `pnpm build && pnpm smoke:daemon`.
 */
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

async function client(name: string, dir = dataDir) {
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(here, "index.js")],
        // Deliberately no DENKMIT_PASSPHRASE: in daemon mode the client holds no key.
        env: { PATH: process.env.PATH ?? "", DENKMIT_DATADIR: dir, DENKMIT_DAEMON: "require" },
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
    const seed = startDaemon({
        ...base,
        DENKMIT_DATADIR: seedDir,
        DENKMIT_IDENTITY: "seed-owner",
        DENKMIT_PASSPHRASE: "seed-secret",
        DENKMIT_LISTEN: `/ip4/127.0.0.1/tcp/${port}`,
    });
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
            arguments: { key: forPeer, value: { token: "laptop" }, encryptFor: [peerStatus.identity.cid], includeSelf: false },
        });
        await onSeed.callTool({ name: "memory_set", arguments: { key: forSeed, value: { token: "seed" }, encryptFor: [] } });
        await waitFor("the encrypted facts on the peer", onPeer, forSeed);
        await waitFor("the encrypted facts on the peer", onPeer, forPeer);
        type Read = { encrypted?: boolean; readable?: boolean; value: { token?: string } | null; recipients?: string[] };
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
        await onSeed.close();
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
    await a.close();
    const still = firstText(await b.callTool({ name: "memory_get", arguments: { key } })) as { found: boolean };
    assert(still.found, "closing one client must not affect another");
    console.log("writes are shared; closing one client leaves the others working");

    const second = startDaemon();
    assert((await exitCode(second)) === 1, "a second daemon on the same socket must refuse to start");
    console.log("a second daemon refuses to start");

    await b.close();
    daemon.kill("SIGTERM");
    assert((await exitCode(daemon)) === 0, "daemon must shut down cleanly");
    daemon = startDaemon();
    await waitForSocket();
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
    console.log("MCP DAEMON SMOKE TEST PASSED");
} finally {
    if (daemon.exitCode === null) daemon.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
}
