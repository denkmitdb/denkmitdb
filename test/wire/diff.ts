/**
 * Debug helper: prints every deterministic payload that differs from wire-v4.json,
 * decoded. Run: `npx tsx test/wire/diff.ts` (no output = byte-identical).
 */
import { readFileSync } from "node:fs";
import * as codec from "@ipld/dag-cbor";
import { fromString } from "uint8arrays";
import { createTestNode } from "../helpers";
import { installCaptured, runDeterministicFlows } from "./wire-flows";

const fixture = JSON.parse(readFileSync(new URL("./wire-v4.json", import.meta.url), "utf8"));
const node = await createTestNode("wire-diff");
const id = await installCaptured(node.helia, fixture.captured);
const got = await runDeterministicFlows(node.helia, id);
const show = (hex: string) => JSON.stringify(codec.decode(fromString(hex, "hex")));
for (let i = 0; i < Math.max(got.payloads.length, fixture.deterministic.payloads.length); i++) {
    if (got.payloads[i] !== fixture.deterministic.payloads[i]) {
        console.log(`#${i}\n want ${show(fixture.deterministic.payloads[i])}\n got  ${show(got.payloads[i])}`);
    }
}
await node.stop();
process.exit(0);
