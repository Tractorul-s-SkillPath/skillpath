/**
 * Submission and grading.
 *
 * Layer: SERVICE
 * Stories: SP-046, SP-050, SP-054, SP-055
 *
 * Sketch
 *  submit(userId, assessmentId): Result<ScoreResult>
 *   1. load responses (user client) — proves ownership through RLS
 *   2. load the answer key with the ADMIN client — the browser never sees it
 *   3. pure scoreAssessment() from lib/domain
 *   4. write is_correct per response (the D4 snapshot) + total_score,
 *      status='submitted', submitted_at — assessment_score_present makes a
 *      submitted-but-unscored row impossible
 *   5. upsert category_progress (SP-054 — upsert, so a second run updates)
 *   6. build + persist the plan (plan.service)
 *   - already submitted -> 'conflict'. No double scoring (SP-046 AC3).
 *   - the signature takes no score. A forged total_score cannot be expressed
 *     as an argument, let alone written (SP-055).
 *
 * Test: tests/lib/services/grading.service.test.ts
 */
