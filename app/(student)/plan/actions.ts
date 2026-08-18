/**
 * Plan actions.
 *
 * Layer: ACTION
 * Story: SP-063
 *
 * Sketch
 *  updatePlanItemStatus({ recommendationId, status })
 *   - assertAuth, planStatusSchema.safeParse (enum only)
 *   - the update writes progress_status AND NOTHING ELSE. topic_title and
 *     priority are not in the payload and not in the update statement.
 *   - another student's item -> RLS rejects; surface it as 403, not a crash
 *
 * Test: tests/app/(student)/plan/actions.test.ts
 */
