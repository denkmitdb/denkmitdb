/**
 * Package smoke test: proves the *packed* artifact is a loadable ESM package
 * with resolvable types and exactly the public API — no more, no less.
 *
 * What it does:
 *   1. `pnpm pack` the repository.
 *   2. Extract the tarball to a temp directory.
 *   3. Verify the manifest's entry points exist in the tarball.
 *   4. Import the real entry file and assert the runtime exports equal PUBLIC_EXPORTS
 *      (an internal leaking out is a failure, like a public name going missing).
 *   5. Typecheck a small consumer against the packed declarations: the public
 *      types resolve, and internals (tree, sync, storage) stay out of reach.
 *
 * Dependencies are satisfied by symlinking the repo's node_modules next to the
 * extracted package rather than doing a full install of the tarball — that keeps
 * the smoke test fast and offline while still exercising the packed entry point.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), "denkmitdb-pack-"));

/** The runtime surface of the package. Keep in sync with src/index.ts. */
const PUBLIC_EXPORTS = [
    "DenkmitError",
    "createDatabase",
    "createIdentity",
    "decryptValue",
    "encryptValueFor",
    "encryptedValueRecipients",
    "fetchIdentity",
    "hasIdentity",
    "isDenkmitError",
    "isEncryptedValue",
    "openDatabase",
    "openIdentity",
].sort();

const CONSUMER = `
import {
    createDatabase,
    openDatabase,
    isEncryptedValue,
    isDenkmitError,
    encryptValueFor,
    type CreateDatabaseOptions,
    type ErrorCode,
    type Database,
    type HeliaNode,
    type Identity,
    type PolicyDefinition,
    type PolicyRule,
    type Provenance,
    type SigningIdentity,
} from "@denkmitdb/denkmitdb";

declare const helia: HeliaNode;
declare const identity: SigningIdentity;
declare const db: Database<{ n: number }>;

const created: Promise<Database<{ n: number }>> = createDatabase<{ n: number }>("x", {
    helia,
    identity,
    consensus: { access: "public", validity: { version: 1, name: "v", description: "d", logic: true } },
});
const opened: Promise<Database<unknown>> = openDatabase("bafy", { helia, identity });
const provenance: Promise<Provenance | undefined> = db.provenance("k");
const asPublic: Identity = identity;
const accessName: string = db.consensus.access.name;
const validityCid: string = db.manifest.consensus.validity.toString();
const writer: Promise<string | undefined> = db.provenance("k").then((p) => p?.writer.toString());
const isEnc: boolean = isEncryptedValue(null);
const policy: PolicyDefinition = { version: 1, name: "p", description: "d", logic: true };

// @ts-expect-error the tree is internal
void db.layers;
// @ts-expect-error merging is internal
void db.merge;
const custom: CreateDatabaseOptions<unknown> = { helia, identity, consensus: { access: { policy } } };
// @ts-expect-error access options moved under consensus
const removed: CreateDatabaseOptions<unknown> = { helia, identity, access: "public" };
// @ts-expect-error a fetched identity cannot sign
void (asPublic as Identity).sign;

const denied: boolean = isDenkmitError(new Error("x"), "ACCESS_DENIED");
const someCode: ErrorCode = "VALIDITY_REJECTED";
const rule: PolicyRule = { startsWith: [{ var: "entryKey" }, "facts/"] };
// @ts-expect-error operators outside DenkMit Logic 1 do not type-check
const outside: PolicyRule = { "+": [1, 1] };
const sealed = encryptValueFor(identity, 1, { database: "db", key: "k", writer: "w" });
// @ts-expect-error the encryption context is required
const unbound = encryptValueFor(identity, 1);

export { rule, outside, denied, someCode, sealed, unbound, created, opened, provenance, accessName, validityCid, writer, isEnc, custom, removed };
`;

try {
    const tarball = execFileSync("pnpm", ["pack", "--pack-destination", workDir], { cwd: root, encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1);
    console.log("packed:", tarball);

    execFileSync("tar", ["xzf", tarball, "-C", workDir]);
    const pkgDir = join(workDir, "package");

    const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    for (const rel of [manifest.main, manifest.types, manifest.exports["."].types, manifest.exports["."].import]) {
        if (!existsSync(join(pkgDir, rel))) throw new Error(`entry point missing from tarball: ${rel}`);
    }
    console.log("entry points present:", manifest.main, "+", manifest.types);

    symlinkSync(join(root, "node_modules"), join(pkgDir, "node_modules"), "dir");
    const mod = await import(pathToFileURL(join(pkgDir, manifest.exports["."].import)).href);

    const actual = Object.keys(mod).sort();
    const missing = PUBLIC_EXPORTS.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !PUBLIC_EXPORTS.includes(name));
    if (missing.length > 0) throw new Error(`missing exports: ${missing.join(", ")}`);
    if (extra.length > 0) throw new Error(`unexpected (internal?) exports: ${extra.join(", ")}`);
    console.log(`imported OK: exactly the ${PUBLIC_EXPORTS.length} public exports`);

    if (mod.isEncryptedValue({ denkmitEncrypted: 1 }) !== false) throw new Error("packed isEncryptedValue misbehaves");

    // Typecheck a consumer against the packed declarations.
    const consumerDir = join(workDir, "consumer");
    mkdirSync(join(consumerDir, "node_modules", "@denkmitdb"), { recursive: true });
    symlinkSync(pkgDir, join(consumerDir, "node_modules", "@denkmitdb", "denkmitdb"), "dir");
    writeFileSync(join(consumerDir, "consumer.ts"), CONSUMER);
    writeFileSync(
        join(consumerDir, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                module: "NodeNext",
                moduleResolution: "NodeNext",
                target: "ES2022",
                lib: ["ES2022", "DOM"],
                strict: true,
                noEmit: true,
                skipLibCheck: true,
                types: [],
            },
            files: ["consumer.ts"],
        }),
    );
    execFileSync(join(root, "node_modules", ".bin", "tsc"), ["-p", consumerDir], { stdio: "inherit" });
    console.log("consumer typechecks against the packed declarations");

    console.log("PACKAGE SMOKE TEST PASSED");
} finally {
    rmSync(workDir, { recursive: true, force: true });
}
