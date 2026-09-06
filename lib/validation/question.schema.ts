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

/**
 * The topic bounds are the DATABASE's, copied deliberately.
 * `recommendation_plans.topic_title` is `check (char_length(trim(...)) between
 * 2 and 200)`, and a question's topic is copied verbatim into that column when
 * a member misses it — so a topic this file accepts and that table refuses is a
 * plan row that fails to insert months after the question was written, in a
 * path that swallows failure. Two places to change if the limit moves.
 */
export const TOPIC_TITLE_MIN = 2;
export const TOPIC_TITLE_MAX = 200;
export const STUDY_ADVICE_MAX = 500;

/**
 * A field an admin may leave blank, trimmed, with '' meaning null.
 *
 * `''` and `null` have to end up as the same thing: an empty text input posts
 * an empty string, the column is nullable, and a topic of `''` would pass a
 * `.min(2)` check only by failing it with a message about a field the admin
 * deliberately skipped.
 */
const optionalText = (max: number, tooLong: string, min = 1, tooShort = tooLong) =>
    z
        .string()
        .optional()
        .transform((value) => value?.trim() ?? '')
        .transform((value) => (value === '' ? null : value))
        .pipe(z.string().min(min, tooShort).max(max, tooLong).nullable());

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

        /**
         * What the question TESTS, and what to reread when it is missed — the
         * two columns a plan is built from (SP-060).
         *
         * Optional, because the bank predates them and a question without them
         * is still a perfectly good question; it simply never becomes a
         * recommendation. Required TOGETHER, though — see the refine below.
         */
        topicTitle: optionalText(
            TOPIC_TITLE_MAX,
            `Keep the topic under ${TOPIC_TITLE_MAX} characters.`,
            TOPIC_TITLE_MIN,
            `Use at least ${TOPIC_TITLE_MIN} characters, or leave the topic blank.`,
        ),

        studyAdvice: optionalText(
            STUDY_ADVICE_MAX,
            `Keep the advice under ${STUDY_ADVICE_MAX} characters.`,
        ),

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
    )
    .refine((question) => !question.topicTitle === !question.studyAdvice, {
        // Half of the pair is silently worth nothing: the plan builder skips a
        // missed question unless it has BOTH a topic to group by and advice to
        // print, so a topic with no advice is an admin typing into a field that
        // will never appear anywhere. Better to say so at the form.
        message: 'Give a topic and advice together, or leave both blank.',
        path: ['studyAdvice'],
    });

export type QuestionInput = z.infer<typeof questionSchema>;

/**
 * SP-092. What an admin may ask the generator for.
 *
 * The count is bounded at both ends, and the ceiling is the interesting half:
 * every generated question costs tokens and, more to the point, costs a human
 * the time to review it. Ten is about as many drafts as anyone will actually
 * read in one sitting, and a bank is built over several sittings anyway.
 */
export const GENERATE_COUNT_MIN = 1;
export const GENERATE_COUNT_MAX = 10;
export const GENERATE_COUNT_DEFAULT = 5;

export const generateQuestionsSchema = z.object({
    categoryId: z.coerce.number().int().positive(),
    difficulty: skillLevel,
    count: z.coerce
        .number()
        .int()
        .min(GENERATE_COUNT_MIN, `Ask for at least ${GENERATE_COUNT_MIN}.`)
        .max(GENERATE_COUNT_MAX, `Ask for at most ${GENERATE_COUNT_MAX} at a time.`),
});

export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
