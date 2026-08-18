/**
 * category_progress table.
 *
 * Layer: REPOSITORY
 * Stories: SP-054, SP-070, SP-071
 *
 * Sketch: upsert(userId, categoryId, level, lastScore) on the unique
 * (user_id, category_id) — a second assessment updates the row, it does not
 * add one (SP-054 AC2). listForUser, scoreTrend(userId, categoryId).
 *
 * Writes are service-role only; students read their own rows through RLS.
 *
 * Test: tests/lib/repositories/progress.repo.test.ts (integration)
 */
