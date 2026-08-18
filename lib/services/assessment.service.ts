/**
 * Assessment lifecycle.
 *
 * Layer: SERVICE
 * Stories: SP-041, SP-042, SP-043, SP-044, SP-047
 *
 * Sketch
 *  generate(userId, categoryId, level): Result<AssessmentId>
 *   - picks eligible questions (active, correct answer present, level-matched)
 *   - ONE transaction: assessments row + one student_responses row per question
 *     with null answer and sequential position (D2)
 *   - an in-progress run already exists -> return that id, do not create.
 *     The partial unique index is the backstop if two tabs race (SP-042)
 *   - fewer questions than requested -> generate what exists and warn, or refuse
 *     below MIN_QUESTIONS_TO_GENERATE. Decide once, document in constants.
 *
 *  getRun(userId, assessmentId)  - responses ordered by position, joined to the
 *    answer_options view. This is what makes refresh-safe resume work (SP-044).
 *  saveAnswer(...)   - writes selected_answer_id + answered_at
 *  abandon(...)      - status='abandoned', frees the category (SP-047)
 *
 * Test: tests/lib/services/assessment.service.test.ts
 */
