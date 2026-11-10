/**
 * The thin client's pipe to the daemon, surviving daemon restarts.
 *
 * MCP over stdio is newline-delimited JSON-RPC. The daemon starts a fresh MCP
 * session for every socket connection, so after a restart a plain reconnect would
 * hand the new session requests it was never initialized for. The relay therefore
 * remembers the client's `initialize` request and `notifications/initialized`, and
 * after reconnecting replays them to the daemon itself, swallowing the replayed
 * response, before it lets traffic through again. The agent's MCP client never
 * sees the restart, apart from requests that could not be answered:
 *
 * - requests in flight when the connection dropped get a JSON-RPC error saying the
 *   daemon restarted (the request may or may not have been applied);
 * - requests sent while the daemon is away wait up to `waitMs` for it, then get an
 *   error saying it is unavailable.
 */
import { connect, type Socket } from "node:net";
import type { Readable, Writable } from "node:stream";

type JsonRpc = { jsonrpc?: string; id?: string | number | null; method?: string; [k: string]: unknown };

export type RelayOptions = {
    /** How long a request waits for a reconnect before it fails. */
    waitMs?: number;
    /** Delay between reconnect attempts. */
    retryMs?: number;
    log?: (message: string) => void;
    /** Called when the client closes its input and the relay has shut down. */
    onEnd?: () => void;
};

/** Connects to a Unix socket, or resolves undefined when nothing listens there. */
export function tryConnect(path: string): Promise<Socket | undefined> {
    return new Promise((resolve) => {
        const socket = connect(path);
        socket.once("connect", () => resolve(socket));
        socket.once("error", () => resolve(undefined));
    });
}

/** Splits a byte stream into newline-delimited messages. */
function lines(onLine: (line: string) => void): (chunk: Buffer | string) => void {
    let buffer = "";
    return (chunk) => {
        buffer += chunk.toString();
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, index).replace(/\r$/, "");
            buffer = buffer.slice(index + 1);
            if (line.trim()) onLine(line);
        }
    };
}

function parse(line: string): JsonRpc | undefined {
    try {
        const message = JSON.parse(line) as JsonRpc;
        return typeof message === "object" && message !== null ? message : undefined;
    } catch {
        return undefined;
    }
}

const isRequest = (m: JsonRpc | undefined): m is JsonRpc & { id: string | number } =>
    m !== undefined && typeof m.method === "string" && (typeof m.id === "string" || typeof m.id === "number");

/**
 * Relays `input` (the agent's MCP client) to the daemon at `path` and the daemon's
 * output back to `output`, reconnecting whenever the daemon goes away.
 */
export function relay(first: Socket, path: string, input: Readable, output: Writable, options: RelayOptions = {}): void {
    const waitMs = options.waitMs ?? 15_000;
    const retryMs = options.retryMs ?? 1_000;
    const log = options.log ?? ((m: string) => console.error(`[denkmit-mcp] ${m}`));

    let socket: Socket | undefined;
    let ready = false; // connected and (re)initialized
    let ending = false;
    let initialize: string | undefined; // the client's initialize request, verbatim
    let initialized: string | undefined; // its notifications/initialized
    let replayCount = 0;
    let replayId: string | undefined; // id of the replayed initialize awaiting its response
    const inFlight = new Map<string | number, NodeJS.Timeout | undefined>(); // request id -> wait timer (queued only)
    const queue: string[] = [];

    const reply = (id: string | number, message: string) => {
        output.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n");
    };
    const send = (line: string) => socket?.write(line + "\n");

    const fromDaemon = lines((line) => {
        const message = parse(line);
        if (message && replayId !== undefined && message.id === replayId) {
            // The daemon answered the replayed initialize: complete the handshake and
            // let the queued traffic through.
            replayId = undefined;
            if (initialized) send(initialized);
            ready = true;
            for (const queued of queue.splice(0)) {
                const id = parse(queued)?.id;
                if (id !== undefined && id !== null) {
                    clearTimeout(inFlight.get(id));
                    inFlight.set(id, undefined);
                }
                send(queued);
            }
            log(`reconnected to the daemon at ${path}`);
            return;
        }
        if (message && (typeof message.id === "string" || typeof message.id === "number") && !("method" in message)) {
            inFlight.delete(message.id); // a response
        }
        output.write(line + "\n");
    });

    const attach = (next: Socket, replay: boolean) => {
        socket = next;
        next.on("data", fromDaemon);
        next.once("close", onClose);
        next.on("error", () => {}); // "close" follows; handled there
        if (replay && initialize) {
            const message = parse(initialize)!;
            replayId = `denkmit-relay-replay-${++replayCount}`;
            send(JSON.stringify({ ...message, id: replayId }));
        } else {
            ready = true;
        }
    };

    const reconnect = async () => {
        while (!ending) {
            const next = await tryConnect(path);
            if (next) {
                if (ending) {
                    next.destroy();
                    return;
                }
                attach(next, true);
                return;
            }
            await new Promise((r) => setTimeout(r, retryMs));
        }
    };

    function onClose() {
        socket = undefined;
        ready = false;
        replayId = undefined;
        if (ending) return;
        // Requests sent before the drop will never be answered by the new session.
        for (const [id, timer] of inFlight) {
            if (timer === undefined) {
                inFlight.delete(id);
                reply(id, "The denkmitd daemon restarted before answering; the request may or may not have been applied. Retry it.");
            }
        }
        log(`lost the daemon at ${path}; reconnecting`);
        void reconnect();
    }

    input.on(
        "data",
        lines((line) => {
            const message = parse(line);
            if (message?.method === "initialize" && initialize === undefined) initialize = line;
            if (message?.method === "notifications/initialized" && initialized === undefined) initialized = line;
            if (ready) {
                if (isRequest(message)) inFlight.set(message.id, undefined);
                send(line);
                return;
            }
            if (isRequest(message)) {
                const id = message.id;
                queue.push(line);
                inFlight.set(
                    id,
                    setTimeout(() => {
                        const at = queue.indexOf(line);
                        if (at >= 0) queue.splice(at, 1);
                        inFlight.delete(id);
                        reply(id, `The denkmitd daemon at ${path} is not available (waited ${Math.round(waitMs / 1000)} s); is it running?`);
                    }, waitMs),
                );
            } else if (message?.method !== "notifications/initialized") {
                queue.push(line); // other notifications follow once reconnected
            }
        }),
    );
    input.once("end", () => {
        ending = true;
        for (const timer of inFlight.values()) clearTimeout(timer);
        if (socket) {
            socket.once("close", () => options.onEnd?.());
            socket.end();
        } else {
            options.onEnd?.();
        }
    });

    log(`using the denkmitd daemon at ${path}`);
    attach(first, false);
}
