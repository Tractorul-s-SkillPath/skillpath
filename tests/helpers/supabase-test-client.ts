/**
 * Clients for the database-backed tests.
 *
 * Used by tests/db and tests/lib/repositories only.
 *
 * Sketch
 *  - adminClient()            service role, for arranging state
 *  - studentClient(userId)    a real anon-key client with a real user token —
 *                             this is what makes an RLS assertion meaningful
 *  - adminUserClient()        same, for a user whose profile role is 'admin'
 *  - resetDatabase()          truncate in FK order, then reseed, between suites
 *
 * Points at a SEPARATE Supabase test project. If these tests can reach the
 * project the demo runs on, that is the incident, not the test failure.
 */
