/**
 * Read the current session.
 *
 * Stories: SP-010, SP-012
 *
 * Sketch: getCurrentUser() -> { userId, role, status } | null, from
 * supabase.auth.getUser() (verified server-side) joined to profiles. Never from
 * getSession(), which trusts the cookie payload.
 *
 * Test: tests/lib/auth/current-user.test.ts
 */
