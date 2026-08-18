/**
 * assertAuth() — the guard every student-facing action starts with.
 *
 * Story: SP-012
 *
 * Sketch: returns the user id or redirects to /login. Also refuses an inactive
 * account (SP-014).
 *
 * It returns the user id specifically so callers stop reading it from the form.
 * "Never trust user_id from a form; derive ownership from auth.uid()" (§5) is
 * easiest to obey when the correct value is what the guard already handed you.
 *
 * Test: tests/lib/auth/assertAuth.test.ts
 */
