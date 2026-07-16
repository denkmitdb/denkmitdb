/**
 * Stub for `node-datachannel/polyfill` (see package.json in this directory).
 *
 * `@libp2p/webrtc` (statically imported by helia's default libp2p config)
 * imports these three names at module load. They only need to exist at import
 * time; DenkMitDB never uses the WebRTC transport, so they throw if used.
 */
class WebRTCUnavailable {
    constructor() {
        throw new Error(
            "WebRTC is unavailable: node-datachannel is stubbed in this repository (see stubs/node-datachannel). " +
                "Use the TCP transport, or remove the pnpm override and build the real native module.",
        );
    }
}

export const RTCPeerConnection = WebRTCUnavailable;
export const RTCSessionDescription = WebRTCUnavailable;
export const RTCIceCandidate = WebRTCUnavailable;

export default { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate };
