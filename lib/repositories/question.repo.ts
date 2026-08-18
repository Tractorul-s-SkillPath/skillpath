/**
 * questions + answers tables. SERVICE ROLE ONLY.
 *
 * Layer: REPOSITORY
 * Stories: SP-034, SP-035, SP-036, SP-037, SP-084, SP-092
 *
 * Sketch
 *  listPaged(filters)         - text search + category/difficulty/status/source
 *  findWithAnswers(id)        - admin shape, includes isCorrect
 *  insertWithAnswers(...)     - question + its options together
 *  updateWithAnswers(...)     - must not touch student_responses
 *  findAnswerKey(questionIds) - grading only, never returned to a page
 *  pickEligible(categoryId, level, count)
 *
 * This file uses the admin client because `answers` is revoked from anon and
 * authenticated (§5). Nothing here is reachable without assertAdmin() upstream
 * — except findAnswerKey, which is called by grading and returns to the server
 * only. If a function in this file ever returns isCorrect to a page, SP-038 is
 * broken.
 *
 * Test: tests/lib/repositories/question.repo.test.ts (integration)
 */
