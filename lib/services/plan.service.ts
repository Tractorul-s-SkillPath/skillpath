/**
 * Learning plan.
 *
 * Layer: SERVICE
 * Stories: SP-061, SP-062, SP-063, SP-065
 *
 * Sketch
 *  generateAndPersist(userId, assessmentId, results)
 *   - pure buildPlan() -> rows in recommendation_plans linked to assessment_id
 *   - upsert on (user_id, category_id, topic_title): re-running the same
 *     category updates rather than duplicating (SP-061 AC2)
 *  getPlan(userId)          - grouped by category, ordered by priority
 *  updateItemStatus(userId, recommendationId, status)
 *   - writes progress_status ONLY. topic_title and priority are not parameters (SP-063)
 *  supersede(...)           - the documented "latest assessment wins" rule (SP-065)
 *
 * Test: tests/lib/services/plan.service.test.ts
 */
