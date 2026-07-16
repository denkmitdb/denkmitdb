import { defineConfig } from "vitest/config";

// WebRTC note: helia transitively imports node-datachannel (a native module
// whose build fails on modern Node). It is replaced repo-wide by a stub via
// pnpm.overrides in package.json (see stubs/node-datachannel), so no test-only
// aliasing is needed here — tests exercise the same module graph as `node`.
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        // Unit tests should fail fast; integration tests that spin up real
        // libp2p/Helia nodes declare their own longer timeouts inline.
        testTimeout: 10_000,
        hookTimeout: 15_000,
    },
});
