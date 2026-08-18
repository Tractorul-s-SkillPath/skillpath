/**
 * Admin aggregates.
 *
 * Layer: SERVICE
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * Sketch
 *  getOverview()        - total users, assessments completed, average score,
 *                         most common weak category
 *  getWeakCategoryRanking()  - ONE SQL aggregate via stats.repo. Never
 *                         "select all assessments, count in JS" (SP-081)
 *  listAllResults(filters)   - server-side sort + page, bounded
 *
 * Uses the admin client behind assertAdmin(). Verified with EXPLAIN against the
 * indexes from migration 0001 (SP-086).
 *
 * Test: tests/lib/services/admin-stats.service.test.ts
 */
