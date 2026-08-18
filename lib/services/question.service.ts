/**
 * Question bank.
 *
 * Layer: SERVICE
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037, SP-084
 *
 * Sketch
 *  listQuestions(filters)   - server-side paging + filtering, bounded result set
 *  createQuestion(input)    - assertAdmin, then question + answers in one write
 *  updateQuestion(input)    - MUST NOT touch student_responses.is_correct (D4)
 *  setStatus(id, status)    - refuse to activate a question with no correct answer
 *
 * Every function in this file starts with assertAdmin() and uses the SERVICE
 * ROLE client, because `answers` is revoked from anon and authenticated (§5).
 * This is the one slice of authorization we consciously moved out of the
 * database and into code — so it is the slice that needs the most tests.
 *
 * Test: tests/lib/services/question.service.test.ts
 */
