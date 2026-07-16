/**
 * Package smoke test: proves the *packed* artifact is a loadable ESM package
 * with resolvable types — the failure mode that shipped broken in v1.0.0
 * (extensionless relative specifiers, see KNOWN_ISSUES.md "Packaging").
 *
 * What it does:
 *   1. `pnpm pack` the repository.
 *   2. Extract the tarball to a temp directory.
 *   3. Verify the manifest's entry points exist in the tarball.
 *   4. Import the real entry file and assert the core API surface.
 *
 * Dependencies are satisfied by symlinking the repo's node_modules next to the
 * extracted package rather than a full `npm install` of the tarball: consumer
 * installs currently fail on the native node-datachannel build (stubbed only
 * inside this repo — see stubs/node-datachannel), which is tracked for the
 * helia/libp2p upgrade phase in ROADMAP.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), "denkmitdb-pack-"));

const EXPECTED_EXPORTS = [
    "createDenkmitDatabase",
    "openDenkmitDatabase",
    "createIdentity",
    "openIdentity",
    "createEntry",
    "fetchEntry",
    "createPollard",
    "createEmptyPollard",
    "createLeaf",
    "createHead",
    "createManifest",
    "createSyncController",
    "createConsensus",
    "HeliaController",
    "SortedItemsStore",
];

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

    const missing = EXPECTED_EXPORTS.filter((name) => typeof mod[name] === "undefined");
    if (missing.length > 0) throw new Error(`missing exports: ${missing.join(", ")}`);
    console.log(`imported OK: ${Object.keys(mod).length} exports, all ${EXPECTED_EXPORTS.length} expected names present`);

    // Minimal no-network behavioral check through the packed code path.
    const pollard = await mod.createEmptyPollard(3);
    const leafCid = await pollard.getCID();
    if (!leafCid || pollard.maxLength !== 8) throw new Error("packed pollard behaves unexpectedly");
    console.log("packed pollard works, empty root CID:", leafCid.toString());

    console.log("PACKAGE SMOKE TEST PASSED");
} finally {
    rmSync(workDir, { recursive: true, force: true });
}
