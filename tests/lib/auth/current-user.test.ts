/**
 * Tests for lib/auth/current-user.ts.
 *
 * Cases
 *  - no session -> null
 *  - a session -> userId, role and status from the profiles row
 *  - it uses getUser() (server-verified), not getSession() — assert against a
 *    tampered cookie payload that claims role='admin'
 */
