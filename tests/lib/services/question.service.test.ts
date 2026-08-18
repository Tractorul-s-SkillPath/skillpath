/**
 * Tests for lib/services/question.service.ts.
 *
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037
 *
 * Cases
 *  - a non-admin caller -> forbidden, and the fake repo recorded ZERO writes
 *    (SP-037 AC2 — assert the absence of the write, not just the return value)
 *  - createQuestion writes the question and its answers together
 *  - two correct answers -> rejected before any write
 *  - updateQuestion does not touch student_responses (D4 / SP-035)
 *  - activating a question with no correct answer -> refused (SP-036)
 *  - listQuestions always applies a bound, even with no filters (SP-086)
 */
