/**
 * Zod schemas for MODEL OUTPUT.
 *
 * Stories: SP-090, SP-091, SP-092, SP-093
 *
 * Sketch
 *  draftQuestionSchema  text, 2-6 options, exactly one correct — the SAME
 *    invariant as the admin form. A model that returns two correct answers is a
 *    caught validation error, not a database constraint violation at 2am.
 *  enhancedPlanSchema   per-item ai_description, bounded length
 *  draftedPlanSchema    a whole plan the model wrote from missed questions —
 *    titles and descriptions bounded by what the DATABASE will take, because
 *    these are written into columns rather than merely rendered
 *  feedbackSchema       a string, bounded length
 *
 * Rule §6.1: model output is untrusted input. This file is the boundary.
 *
 * Test: tests/lib/ai/schemas.test.ts
 */
import { z } from 'zod';
import { skillLevel } from '../validation/common';
import { STUDY_ADVICE_MAX, TOPIC_TITLE_MAX, TOPIC_TITLE_MIN } from '../validation/question.schema';

export const draftQuestionSchema = z
    .object({
        question: z.string().min(1, 'Question text is required'),
        options: z
            .array(z.string().min(1))
            .min(2, 'At least 2 options are required')
            .max(6, 'Maximum 6 options allowed'),
        correctAnswer: z.string().min(1, 'Correct answer is required'),

        /**
         * What the question tests, and what to reread when it is missed — the
         * pair a plan row is built from (SP-060).
         *
         * OPTIONAL, unlike on the admin form, and the asymmetry is deliberate.
         * A model that forgets them has still written a usable question, and
         * dropping it would trade a real question for a missing paragraph. The
         * service pairs them or discards both, so a topic with no advice can
         * never reach the bank half-written.
         */
        topicTitle: z.string().min(1).max(TOPIC_TITLE_MAX).optional(),
        studyAdvice: z.string().min(1).max(STUDY_ADVICE_MAX).optional(),
    })
    .refine((data) => data.options.includes(data.correctAnswer), {
        message: 'The correct answer must be one of the provided options.',
        path: ['correctAnswer'],
    })
    .refine(
        (data) =>
            new Set(data.options.map((o) => o.trim().toLowerCase())).size === data.options.length,
        {
            // The same rule the admin form enforces. Two identical options make
            // a question unanswerable rather than hard, and a model asked for
            // four distinct wrong answers will sometimes give three.
            message: 'Each option must be different.',
            path: ['options'],
        },
    );

/**
 * A RUNAWAY BOUND, NOT A COUNT CHECK — and the difference decides the number.
 *
 * enhancedPlanSchema has had `.max(30)` since SP-091 and this array had no
 * bound at all, which is the asymmetry this fixes: nothing stopped a
 * generation from arriving with five hundred questions in it, each one then
 * inserted by question.service in its own round trip.
 *
 * It is deliberately NOT GENERATE_COUNT_MAX. This schema is parsed with
 * `.parse` over the whole array in openai-compatible.ts, so a bound set to the
 * exact number requested would throw away eleven good questions because the model
 * gave one more than it was asked for — and the count the admin actually gets
 * is already enforced downstream, per item, by the two boundaries in
 * ai.service. This only has to make "the model went haywire" cheap to reject.
 */
const MAX_DRAFTS_RETURNED = 50;

export const draftQuestionsSchema = z
    .array(draftQuestionSchema)
    .max(MAX_DRAFTS_RETURNED, 'Too many questions returned');

/**
 * SP-091. One entry per plan row the model had something to say about.
 *
 * `topicTitle` is echoed back rather than the row's id being sent out and
 * returned: an id in a prompt is a thing a model can hallucinate a neighbour
 * of, and a wrong id would write advice about indexes onto the row about Git.
 * A title that does not match one the service sent is dropped, so the worst a
 * confused model achieves is fewer decorations.
 *
 * The bound is per item, not per plan. 600 characters is two or three
 * sentences — the column is plain `text` with no constraint of its own, and a
 * model that decides to write an essay must not be able to turn a plan page
 * into one.
 */
export const AI_DESCRIPTION_MAX = 600;

export const enhancedPlanItemSchema = z.object({
    topicTitle: z.string().min(1, 'A topic title is required').max(200),
    aiDescription: z
        .string()
        .min(1, 'AI description is required')
        .max(AI_DESCRIPTION_MAX, 'AI description is too long'),
});

export const enhancedPlanSchema = z.object({
    items: z.array(enhancedPlanItemSchema).max(30, 'Too many plan items returned'),
});

/**
 * How many topics a drafted plan is asked for, and kept to.
 *
 * NOT ENFORCED BY THE SCHEMA, deliberately — same reasoning as
 * MAX_DRAFTS_RETURNED above. A bound set here to the number the prompt asks for
 * would throw away a whole usable plan because the model returned nine topics
 * instead of eight. The prompt asks, `draftPlan` in ai.service keeps the most
 * urgent this many, and the array bound below only has to make "the model went
 * haywire" cheap to reject.
 *
 * Eight is about what fits on a plan page while still reading as a plan.
 * Twenty missed questions could honestly be twenty topics, and a twenty-item
 * study plan is one nobody starts.
 */
export const MAX_DRAFTED_TOPICS = 8;

/**
 * SP-060's fallback. A plan the model wrote from the questions themselves,
 * because the bank carried no `topic_title` for the rules to group by.
 *
 * THE BOUNDS ARE THE DATABASE'S, not a guess. `topic_title` is
 * `check (char_length(trim(topic_title)) between 2 and 200)` and this text is
 * written straight into it, so a title this schema accepts and that column
 * refuses is a plan that fails to insert inside a path that logs and swallows.
 * `description` lands in `ai_description`, whose own check is 1..600.
 *
 * `difficulty` is required rather than optional: it is the only thing the model
 * is asked for that becomes a NUMBER here, and the fallback for a missing one
 * would be an invented urgency. An item without it is dropped, and the rest of
 * the plan survives — see draftPlan in ai.service.
 */
export const draftedPlanItemSchema = z.object({
    topicTitle: z
        .string()
        .trim()
        .min(TOPIC_TITLE_MIN, 'A topic title is required')
        .max(TOPIC_TITLE_MAX, 'Topic title is too long'),
    difficulty: skillLevel,
    description: z
        .string()
        .trim()
        .min(1, 'A description is required')
        .max(AI_DESCRIPTION_MAX, 'Description is too long'),
});

export const draftedPlanSchema = z.object({
    items: z.array(draftedPlanItemSchema).max(30, 'Too many topics returned'),
});

export const feedbackResponseSchema = z
    .string()
    .min(1, 'Feedback cannot be empty')
    .max(1500, 'Feedback exceeds maximum character limit');
