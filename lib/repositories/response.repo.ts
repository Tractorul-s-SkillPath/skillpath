/**
 * student_responses table.
 *
 * Layer: REPOSITORY
 * Stories: SP-043, SP-044, SP-046, SP-053
 *
 * Sketch
 *  listForAssessment(assessmentId)  - ORDER BY position, joined to questions and
 *    to the answer_options VIEW. Never to `answers`.
 *  saveSelection(responseId, answerId)
 *  writeGrades(rows)                - the is_correct snapshots, one statement
 *
 * Ordering by position is not cosmetic: it is what makes a refresh reproduce the
 * same paper (SP-044).
 *
 * Test: tests/lib/repositories/response.repo.test.ts (integration)
 */
