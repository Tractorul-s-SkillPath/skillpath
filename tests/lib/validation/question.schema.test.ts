/**
 * Tests for lib/validation/question.schema.ts.
 *
 * Stories: SP-034, SP-036
 *
 * Cases
 *  - 1 option rejected, 2 accepted, 6 accepted, 7 rejected
 *  - zero correct answers -> form-level error (SP-034 AC2)
 *  - exactly one correct -> parses
 *  - two correct answers -> parses; multi-select is the point, and the index
 *    that used to forbid it (answers_one_correct_per_question) is dropped
 *  - EVERY option correct -> rejected: nothing a member can pick scores less
 *    than full marks, so it is a formality rather than a question
 *  - question text 4 chars rejected, 5 accepted, 1001 rejected
 *  - answer text empty rejected, 500 accepted, 501 rejected
 *  - category and difficulty are required
 */
