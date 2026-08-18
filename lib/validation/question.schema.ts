/**
 * Question + answers schema.
 *
 * Stories: SP-034, SP-035, SP-036
 *
 * Sketch
 *  answerSchema    text 1-500, position
 *  questionSchema  text 5-1000, categoryId, difficulty, status,
 *                  answers: 2-6 items,
 *                  .refine(exactly one isCorrect)  <- SP-034 AC2
 *
 * The refine and answers_one_correct_per_question say the same thing in two
 * languages. Zod gives the admin a message; the index guarantees the invariant.
 *
 * Test: tests/lib/validation/question.schema.test.ts
 */
