import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            // The source imports modules as "src/..." (resolved via tsconfig baseUrl).
            src: fileURLToPath(new URL("./src", import.meta.url)),
            // WebRTC is unused in tests; the native node-datachannel build is skipped.
            "node-datachannel/polyfill": fileURLToPath(
                new URL("./test/stubs/node-datachannel-polyfill.ts", import.meta.url),
            ),
            "node-datachannel": fileURLToPath(
                new URL("./test/stubs/node-datachannel-polyfill.ts", import.meta.url),
            ),
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        server: {
            deps: {
                // Force these through the vite pipeline so the node-datachannel
                // aliases above apply to their internal imports.
                inline: ["helia", "@libp2p/webrtc"],
            },
        },
        // Integration tests spin up real libp2p/Helia nodes over TCP.
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
