/**
 * Test stub for `node-datachannel/polyfill`.
 *
 * The tests never use the WebRTC transport, but Helia's default libp2p config
 * statically imports `@libp2p/webrtc`, which imports these names from
 * `node-datachannel` — a native module whose build is skipped in this repo
 * (see `pnpm.neverBuiltDependencies` in package.json). The classes below only
 * need to exist at import time; they throw if anything tries to use them.
 */
class Unavailable {
    constructor() {
        throw new Error("WebRTC is not available in the test environment (node-datachannel is stubbed)");
    }
}

export const RTCPeerConnection = Unavailable;
export const RTCSessionDescription = Unavailable;
export const RTCIceCandidate = Unavailable;

export default { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate };
