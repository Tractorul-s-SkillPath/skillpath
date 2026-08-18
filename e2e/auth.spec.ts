/**
 * E2E: register -> login -> logout.
 *
 * Story: SP-101 · owner A
 *
 * Sketch
 *  - register a unique email, land on the dashboard
 *  - log out, press Back, assert protected content is NOT shown (SP-010 AC3)
 *  - log back in with the same credentials
 *  - wrong password shows one generic error
 *
 * Runs against the preview URL, not localhost.
 */
