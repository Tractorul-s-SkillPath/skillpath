/**
 * Tests for lib/services/grading.service.ts.
 *
 * Stories: SP-046, SP-050, SP-054, SP-055
 *
 * Cases
 *  - submit writes is_correct on every response, total_score, status='submitted'
 *    and submitted_at (SP-046)
 *  - the score written equals pure scoreAssessment() on the same input
 *  - unanswered questions are graded incorrect, not skipped
 *  - submitting twice -> conflict, and the stored score is unchanged (SP-046 AC3)
 *  - category_progress is UPSERTED: a second run in the same category updates
 *    the existing row (SP-054 AC2)
 *  - a plan is generated and persisted as part of submit
 *  - the function signature accepts no score, so a forged one cannot be passed
 *    at all — the SP-055 assertion is that the type/parse layer rejects it
 */
