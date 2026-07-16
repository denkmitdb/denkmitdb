import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        // Unit tests should fail fast; integration tests that spin up real
        // libp2p/Helia nodes declare their own longer timeouts inline.
        testTimeout: 10_000,
        hookTimeout: 15_000,
    },
});
