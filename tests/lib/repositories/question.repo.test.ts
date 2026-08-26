/**
 * Integration tests for lib/repositories/question.repo.ts.
 *
 * Stories: SP-034, SP-036, SP-037, SP-084
 *
 * Cases
 *  - insertWithAnswers writes the question and all options atomically; a bad
 *    option leaves NO question behind
 *  - a second correct answer is STORED: answers_one_correct_per_question is
 *    dropped, and multi-select questions are the reason it went
 *  - pickEligible returns only active questions with a correct answer, at the
 *    requested level, and never more than the requested count
 *  - the text filter runs in Postgres (EXPLAIN shows the index, SP-086)
 *  - findAnswerKey works with the service role and fails with a student token
 */
