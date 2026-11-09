/**
 * Every error DenkMitDB raises on purpose is a {@link DenkmitError} with a stable
 * `code`. Codes are part of the API and the same in every implementation; match
 * on the code, never on the message.
 */

/** Stable error codes. */
export type ErrorCode =
    /** A caller-supplied argument or option is invalid (unknown preset, bad subtree size, removed option, …). */
    | "INVALID_ARGUMENT"
    /** The access rule refuses this identity writing or deleting this key. */
    | "ACCESS_DENIED"
    /** The validity rule refuses this entry. */
    | "VALIDITY_REJECTED"
    /** A named local thing does not exist (identity in the keychain, …). */
    | "NOT_FOUND"
    /** A named local thing exists already (identity in the keychain). */
    | "ALREADY_EXISTS"
    /** A block could not be fetched (not held locally and no peer provided it in time). */
    | "UNAVAILABLE"
    /** A signature does not verify, or a signed block names no or the wrong key. */
    | "INVALID_SIGNATURE"
    /** A signed payload or block is not well formed. */
    | "MALFORMED"
    /** A format version this implementation does not support. */
    | "UNSUPPORTED_VERSION"
    /** The operation needs a private key this identity was not opened with. */
    | "KEY_UNAVAILABLE"
    /** The passphrase does not decrypt the identity's private key. */
    | "INVALID_PASSPHRASE"
    /** An invariant of this implementation failed (a bug). */
    | "INTERNAL";

/** An error with a stable {@link ErrorCode}. */
export class DenkmitError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "DenkmitError";
        this.code = code;
    }
}

/** Whether `error` is a {@link DenkmitError}, optionally with the given code. */
export function isDenkmitError(error: unknown, code?: ErrorCode): error is DenkmitError {
    return error instanceof DenkmitError && (code === undefined || error.code === code);
}
