/**
 * Assessment run actions.
 *
 * Layer: ACTION
 * Stories: SP-043, SP-046, SP-047, SP-055
 *
 * Sketch
 *  saveAnswer({ assessmentId, questionId, answerId })
 *   - assertAuth, zod; service writes selected_answer_id + answered_at
 *   - ownership is proved by RLS on the update, not by an `if`
 *
 *  submitAssessment({ assessmentId })
 *   - the payload carries ONLY ids. A forged total_score in the body is ignored
 *     — the action never reads one (SP-055)
 *   - service: fetch the key with the admin client -> pure scoreAssessment ->
 *     write is_correct per response + total_score, status='submitted',
 *     submitted_at -> upsert category_progress -> build + persist the plan
 *   - already submitted -> reject, no double scoring (SP-046 AC3)
 *   - redirect to /assessments/[id]/results
 *
 *  abandonAssessment({ assessmentId })  -- SP-047: status='abandoned', frees the
 *   category for a new run, excluded from stats.
 *
 * Test: tests/app/(student)/assessments/[id]/actions.test.ts
 */
