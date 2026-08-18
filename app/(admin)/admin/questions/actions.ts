/**
 * Question bank actions.
 *
 * Layer: ACTION
 * Stories: SP-034, SP-035, SP-036, SP-037
 *
 * Sketch
 *  createQuestion / updateQuestion
 *   - assertAdmin FIRST. A student calling this action directly gets 403 and
 *     nothing is written (SP-037 AC2) — there is a test for exactly that.
 *   - questionSchema.safeParse: 2-6 options, exactly one correct
 *   - service writes question + answers with the SERVICE ROLE client, because
 *     `answers` is revoked from anon and authenticated (§5 trade-off)
 *
 *  setQuestionStatus  -- SP-036: only questions WITH a correct answer can be
 *   activated; refuse otherwise. Only active questions are eligible for
 *   generation.
 *
 * Test: tests/app/(admin)/admin/questions/actions.test.ts
 */
