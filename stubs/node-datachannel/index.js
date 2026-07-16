/**
 * Stub for the `node-datachannel` root entry (see package.json in this
 * directory). Nothing in DenkMitDB's dependency tree imports the root entry
 * today (`@libp2p/webrtc` uses ./polyfill), but it is provided so any future
 * import fails loudly at call time instead of at module load.
 */
function unavailable() {
    throw new Error(
        "node-datachannel is stubbed in this repository (see stubs/node-datachannel); WebRTC is unavailable.",
    );
}

export const initLogger = unavailable;
export const cleanup = unavailable;
export const preload = unavailable;
export const setSctpSettings = unavailable;
export class PeerConnection {
    constructor() {
        unavailable();
    }
}
export class DataChannel {
    constructor() {
        unavailable();
    }
}
export default { initLogger, cleanup, preload, setSctpSettings, PeerConnection, DataChannel };
