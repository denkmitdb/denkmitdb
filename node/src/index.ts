/**
 * @denkmitdb/node — a long-lived DenkMitDB peer.
 *
 * The `denkmitd` binary (./daemon.ts) runs one node per machine: it holds the
 * device and agent keys and the database, keeps replicating over libp2p while no
 * client is open, and serves local clients on Unix sockets. Its local API speaks
 * the Model Context Protocol, so any MCP client — the `denkmit-mcp` thin client of
 * `@denkmitdb/mcp`, or a script — can use it.
 *
 * This entry exports the building blocks for clients and embedders: starting a
 * node from configuration, socket locations, and the local API server.
 */
export * from "./node.js";
export * from "./read.js";
export * from "./tools.js";
