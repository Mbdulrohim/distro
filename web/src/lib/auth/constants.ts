/**
 * Shared auth constants. Values here are not secrets and are safe on both
 * client and server.
 */

/** Session cookie holding the signed SIWE JWT. */
export const SESSION_COOKIE = "distro_session";

/** Short-lived cookie holding the pending SIWE nonce during sign-in. */
export const NONCE_COOKIE = "distro_siwe_nonce";

/** Session lifetime in seconds (7 days). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Nonce lifetime in seconds (10 minutes) — the sign-in window. */
export const NONCE_TTL_SECONDS = 60 * 10;

/** SIWE statement shown to the user in their wallet when signing in. */
export const SIWE_STATEMENT = "Sign in to DISTRO. This does not cost gas and does not authorize any transaction.";
