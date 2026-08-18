/**
 * Tests for lib/validation/question.schema.ts.
 *
 * Stories: SP-034, SP-036
 *
 * Cases
 *  - 1 option rejected, 2 accepted, 6 accepted, 7 rejected
 *  - zero correct answers -> form-level error (SP-034 AC2)
 *  - two correct answers -> rejected (mirrors answers_one_correct_per_question)
 *  - exactly one correct -> parses
 *  - question text 4 chars rejected, 5 accepted, 1001 rejected
 *  - answer text empty rejected, 500 accepted, 501 rejected
 *  - category and difficulty are required
 */
