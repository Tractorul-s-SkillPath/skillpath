/**
 * Progress tracking.
 *
 * Layer: SERVICE
 * Stories: SP-054, SP-070, SP-071, SP-072, SP-073
 *
 * Sketch
 *  getDashboard(userId)
 *   - per category: current level, latest score, plan items completed / total
 *   - overall completion (pure, lib/domain/progress.ts)
 *   - a student with no data returns an EMPTY, WELL-FORMED shape — the page
 *     renders an empty state from it, it does not branch on undefined (SP-073)
 *  getScoreTrend(userId, categoryId)  - submitted assessments, oldest first (SP-071)
 *
 * Test: tests/lib/services/progress.service.test.ts
 */
