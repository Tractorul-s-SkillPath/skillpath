/**
 * Question + answers schema.
 *
 * Stories: SP-034, SP-035, SP-036
 *
 * A question takes AT LEAST one correct option, not exactly one. This used to
 * be `=== 1`, paired with `answers_one_correct_per_question` in 0001 saying the
 * same thing in SQL — Zod for a message the admin can act on, the unique index
 * so the invariant held even for a write that never came through this file.
 *
 * Multi-select questions made the pair wrong rather than redundant, so both
 * halves move together. Dropping the Zod refine alone leaves every two-correct
 * question failing on insert with a constraint error the admin cannot read:
 *
 *   DROP INDEX IF EXISTS answers_one_correct_per_question;
 *
 * `>= 1` is still a real bound. Zero correct options is not a hard question,
 * it is an unanswerable one, and grading has no defensible score for it.
 *
 * Test: tests/lib/validation/question.schema.test.ts
 */

import { z } from 'zod';
import { skillLevel } from './common';

export const QUESTION_TEXT_MIN = 5;
export const QUESTION_TEXT_MAX = 1000;
export const ANSWERS_MIN = 2;
export const ANSWERS_MAX = 6;

export const answerSchema = z.object({
    text: z
        .string()
        .transform((value) => value.trim())
        .pipe(
            z
                .string()
                .min(1, 'An option cannot be empty.')
                .max(500, 'Keep each option under 500 characters.'),
        ),
    isCorrect: z.boolean(),
});

export const questionSchema = z
    .object({
        categoryId: z.coerce.number().int().positive(),

        text: z
            .string()
            .transform((value) => value.trim())
            .pipe(
                z
                    .string()
                    .min(QUESTION_TEXT_MIN, `Use at least ${QUESTION_TEXT_MIN} characters.`)
                    .max(QUESTION_TEXT_MAX, `Keep it under ${QUESTION_TEXT_MAX} characters.`),
            ),

        difficulty: skillLevel,

        answers: z
            .array(answerSchema)
            .min(ANSWERS_MIN, `A question needs at least ${ANSWERS_MIN} options.`)
            .max(ANSWERS_MAX, `A question takes at most ${ANSWERS_MAX} options.`),
    })
    .refine((question) => question.answers.some((answer) => answer.isCorrect), {
        message: 'Mark at least one option as correct.',
        path: ['answers'],
    })
    .refine((question) => !question.answers.every((answer) => answer.isCorrect), {
        // Every option correct is not a question, it is a formality: there is
        // no selection a member can make that scores anything but full marks.
        message: 'At least one option must be incorrect.',
        path: ['answers'],
    })
    .refine(
        (question) => {
            const seen = new Set(question.answers.map((answer) => answer.text.toLowerCase()));
            return seen.size === question.answers.length;
        },
        {
            // Two identical options is not a constraint violation — the database
            // will happily store them — but it makes the question unanswerable,
            // because two of the four buttons are the same claim.
            message: 'Each option must be different.',
            path: ['answers'],
        },
    );

export type QuestionInput = z.infer<typeof questionSchema>;
