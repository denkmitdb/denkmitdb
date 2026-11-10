#!/usr/bin/env node
/**
 * End-to-end test against REAL, already running nodes (not part of CI).
 *
 * Every node runs `denkmitd`; this script reaches each one over SSH (or locally)
 * and talks to its daemon through the installed thin client — the exact path an
 * agent's MCP client uses. One run, all nodes in parallel:
 *
 *   write: status; <own>/e2e/<run>/hello; a secret encrypted to the NEXT node in a
 *          ring; temp written and deleted; a write into the next node's area
 *          (must be refused with ACCESS_DENIED).
 *   read:  every node reads every other node's notes: hello with the right writer
 *          and a signed writtenAt, temp as a tombstone, and each secret readable
 *          exactly by its writer and its recipient.
 *   --restart <name>: one client stays open while that node's daemon restarts
 *          (systemctl --user restart denkmitd) and must keep answering.
 *
 * Usage: node scripts/e2e-mesh.mjs <nodes.json> [--restart <name>] [--timeout <s>]
 * nodes.json: see scripts/e2e-mesh.example.json. Exit code 0 = all checks passed.
 * It writes only under each node's own namespace (agents/<cid>/e2e/<run>/…).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const configPath = args.find((a) => !a.startsWith("--"));
if (!configPath) {
    console.error("usage: node scripts/e2e-mesh.mjs <nodes.json> [--restart <name>] [--timeout <seconds>]");
    process.exit(2);
}
const option = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const restartNode = option("--restart");
const timeoutS = Number(option("--timeout") ?? 120);
const nodes = JSON.parse(readFileSync(configPath, "utf8"));
const run = `run-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

/** The program each node runs: one phase of the test through its own daemon. */
const PROBE = String.raw`
const plan = JSON.parse(Buffer.from(process.argv[2], "base64").toString());
const app = plan.app.replace(/^~/, process.env.HOME);
const sdk = app + "/node_modules/@modelcontextprotocol/sdk/dist/esm";
const { Client } = await import(sdk + "/client/index.js");
const { StdioClientTransport } = await import(sdk + "/client/stdio.js");
const { ToolListChangedNotificationSchema } = await import(sdk + "/types.js");
const env = { PATH: process.env.PATH, HOME: process.env.HOME, DENKMIT_DAEMON: "require" };
if (plan.agent) env.DENKMIT_AGENT = plan.agent;
const client = new Client({ name: "e2e-mesh", version: "0" });
let toolsChanged = false;
client.setNotificationHandler(ToolListChangedNotificationSchema, () => { toolsChanged = true; });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [app + "/dist/index.js"], env, stderr: "pipe" }));
const call = async (name, a = {}) => {
    const r = await client.callTool({ name, arguments: a });
    return { isError: r.isError === true, ...JSON.parse(r.content[0].text) };
};
const out = {};
const status = await call("memory_status");
out.status = { cid: status.identity.cid, name: status.identity.name, ns: status.access.ownNamespace, db: status.databaseAddress, records: status.records, peers: status.connectedPeers.length };
const mine = status.access.ownNamespace + "e2e/" + plan.run + "/";
const of = (cid) => "agents/" + cid + "/e2e/" + plan.run + "/";
if (plan.phase === "write") {
    out.hello = (await call("memory_set", { key: mine + "hello", value: { node: plan.name } })).isError === false;
    const sealed = await call("memory_set", { key: mine + "secret", value: { from: plan.name, to: plan.next.name }, encryptFor: [plan.next.cid] });
    out.secret = sealed.isError ? sealed.error : sealed.recipients;
    out.tempSet = (await call("memory_set", { key: mine + "temp", value: 1 })).isError === false;
    out.tempDelete = (await call("memory_delete", { key: mine + "temp" })).isError === false;
    const intrusion = await call("memory_set", { key: of(plan.next.cid) + "intrusion", value: 1 });
    out.intrusion = intrusion.isError ? intrusion.error.code : "ACCEPTED";
} else if (plan.phase === "read") {
    out.others = {};
    for (const other of plan.others) {
        const r = {};
        const deadline = Date.now() + plan.timeoutMs;
        let hello;
        do {
            hello = await call("memory_get", { key: of(other.cid) + "hello" });
            if (!hello.found) await new Promise((res) => setTimeout(res, 3000));
        } while (!hello.found && Date.now() < deadline);
        r.hello = hello.found ? { writerOk: hello.writer === other.cid, writtenAt: hello.writtenAt ?? null } : "NOT SEEN";
        let secret;
        do {
            secret = await call("memory_get", { key: of(other.cid) + "secret" });
            if (!secret.found) await new Promise((res) => setTimeout(res, 3000));
        } while (!secret.found && Date.now() < deadline);
        r.secret = secret.found ? { readable: secret.readable === true, recipients: secret.recipients } : "NOT SEEN";
        let temp;
        do {
            temp = await call("memory_provenance", { key: of(other.cid) + "temp" });
            if (!(temp.found && temp.deleted)) await new Promise((res) => setTimeout(res, 3000));
        } while (!(temp.found && temp.deleted) && Date.now() < deadline);
        r.tempTombstone = temp.found ? temp.deleted === true : "NOT SEEN";
        out.others[other.name] = r;
    }
} else if (plan.phase === "restart") {
    const { execFileSync } = await import("node:child_process");
    const before = await call("memory_status");
    execFileSync("systemctl", ["--user", "restart", "denkmitd.service"]);
    const t0 = Date.now();
    const after = await call("memory_status");
    out.restart = { answered: !after.isError && after.identity.cid === before.identity.cid, ms: Date.now() - t0, toolsChanged };
}
await client.close();
console.log(JSON.stringify(out));
process.exit(0);
`;

/** Runs one phase on one node and returns its parsed JSON result. */
function probe(node, plan) {
    const encoded = Buffer.from(JSON.stringify({ ...plan, name: node.name, agent: node.agent, app: node.app ?? "~/.local/share/denkmitd/app/mcp" })).toString("base64");
    const pathPrefix = node.nodeBin ? `PATH=${node.nodeBin}:$PATH ` : "";
    const [cmd, cmdArgs] =
        node.ssh === "local"
            ? ["node", ["--input-type=module", "-", encoded]]
            : ["ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", node.ssh, `${pathPrefix}node --input-type=module - ${encoded}`]];
    return new Promise((resolve) => {
        const child = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));
        child.on("close", (code) => {
            try {
                resolve(JSON.parse(stdout.trim().split("\n").at(-1)));
            } catch {
                resolve({ error: `exit ${code}: ${(stderr || stdout).trim().slice(-400)}` });
            }
        });
        child.stdin.end(PROBE);
    });
}

const failures = [];
const check = (ok, what) => {
    console.log(`${ok ? "  ok  " : "  FAIL"} ${what}`);
    if (!ok) failures.push(what);
};

console.log(`e2e mesh ${run}: ${nodes.map((n) => n.name).join(", ")}`);

// 1. status (to learn each node's identity CID)
const status = await Promise.all(nodes.map((n) => probe(n, { phase: "status", run })));
nodes.forEach((n, i) => {
    if (status[i].error) throw new Error(`${n.name}: ${status[i].error}`);
    n.cid = status[i].status.cid;
    console.log(`  ${n.name}: ${status[i].status.name} ${n.cid.slice(0, 16)}… records ${status[i].status.records}, peers ${status[i].status.peers}`);
});
const dbs = new Set(status.map((s) => s.status.db));
check(dbs.size === 1, `all nodes open the same database (${[...dbs].map((d) => d.slice(0, 16)).join(", ")})`);

// 2. write, all nodes in parallel (each encrypts to the next node in the ring)
const writes = await Promise.all(
    nodes.map((n, i) => probe(n, { phase: "write", run, next: { name: nodes[(i + 1) % nodes.length].name, cid: nodes[(i + 1) % nodes.length].cid } })),
);
nodes.forEach((n, i) => {
    const w = writes[i];
    if (w.error) return check(false, `${n.name}: write phase failed: ${w.error}`);
    const next = nodes[(i + 1) % nodes.length];
    check(w.hello && w.tempSet && w.tempDelete, `${n.name}: writes hello, writes and deletes temp`);
    check(Array.isArray(w.secret) && w.secret.includes(next.cid), `${n.name}: seals a secret for ${next.name}`);
    check(w.intrusion === "ACCESS_DENIED", `${n.name}: writing into ${next.name}'s area is refused (${w.intrusion})`);
});

// 3. read, all nodes in parallel
const reads = await Promise.all(
    nodes.map((n) => probe(n, { phase: "read", run, timeoutMs: timeoutS * 1000, others: nodes.filter((o) => o !== n).map((o) => ({ name: o.name, cid: o.cid })) })),
);
nodes.forEach((n, i) => {
    const r = reads[i];
    if (r.error) return check(false, `${n.name}: read phase failed: ${r.error}`);
    for (const other of nodes.filter((o) => o !== n)) {
        const seen = r.others[other.name];
        const j = nodes.indexOf(other);
        const recipient = nodes[(j + 1) % nodes.length];
        check(seen.hello !== "NOT SEEN" && seen.hello.writerOk, `${n.name} sees ${other.name}'s hello, signed by ${other.name}`);
        check(seen.hello !== "NOT SEEN" && typeof seen.hello.writtenAt === "string", `${n.name} gets the signed writtenAt for ${other.name}'s hello`);
        check(seen.tempTombstone === true, `${n.name} sees ${other.name}'s temp as a tombstone`);
        const expectReadable = recipient === n;
        check(
            seen.secret !== "NOT SEEN" && seen.secret.readable === expectReadable,
            `${n.name} ${expectReadable ? "can" : "cannot"} read ${other.name}'s secret for ${recipient.name}` +
                (seen.secret === "NOT SEEN" ? " (not seen)" : seen.secret.readable === expectReadable ? "" : ` (readable: ${seen.secret.readable})`),
        );
    }
});

// 4. optional: a client survives a daemon restart
if (restartNode) {
    const node = nodes.find((n) => n.name === restartNode);
    if (!node) throw new Error(`--restart: no node named ${restartNode}`);
    const r = await probe(node, { phase: "restart", run });
    if (r.error) check(false, `${node.name}: restart phase failed: ${r.error}`);
    else {
        check(r.restart.answered, `${node.name}: an open client keeps answering across a daemon restart (${r.restart.ms} ms)`);
        check(r.restart.toolsChanged, `${node.name}: the client is told to refetch its tools after the restart`);
    }
}

console.log(failures.length === 0 ? `E2E MESH PASSED (${run})` : `E2E MESH FAILED: ${failures.length} check(s)`);
process.exit(failures.length === 0 ? 0 : 1);
