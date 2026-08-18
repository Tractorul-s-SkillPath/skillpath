/**
 * Service-role client. Bypasses RLS. Handle accordingly.
 *
 * Story: SP-002
 *
 * FIRST LINE OF THIS FILE IS:  import 'server-only'
 *
 * That import is the whole security control: if this module is ever pulled into
 * a client bundle, the BUILD FAILS instead of shipping the service role key to
 * a browser (SP-002 AC2 — there is a test that asserts exactly this).
 *
 * Legitimate callers: grading (the answer key), admin aggregates, question-bank
 * writes, the seed script. Each already sits behind assertAdmin() or is
 * server-only by construction.
 */
