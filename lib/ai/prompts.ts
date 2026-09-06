/**
 * Prompt construction — pure, and the only place a prompt string is built.
 *
 * Layer: AI
 * Story: SP-094
 *
 * Sketch
 *  buildEnhancePlanPrompt(context)       - SP-091
 *  buildDraftPlanPrompt(context)         - SP-091, the un-annotated-bank path
 *  buildGenerateQuestionsPrompt(context) - SP-092
 *  buildFeedbackPrompt(context)          - SP-093
 *
 * Two reasons these are functions in their own file rather than template
 * literals next to the fetch:
 *
 *  1. SP-094 is checkable. A test can assert that no builder can be made to
 *    emit an email, a surname or a user id, because the context types have no
 *    field for one. Interpolating at the call site would make that a review
 *    convention instead of a test.
 *  2. The JSON shape the model is asked for and the Zod schema it is parsed
 *    against are written twenty lines apart, so they drift visibly.
 *
 * Free text that reaches a prompt — a topic title, a category name — is DATA.
 * It is admin-authored and it is echoed back into text we render, never into a
 * later prompt and never into a code path, which is what keeps an injected
 * instruction inert rather than dangerous.
 *
 * Test: tests/lib/ai/prompts.test.ts
 */

import { MAX_DRAFTED_TOPICS } from './schemas';

export interface PlanPromptContext {
    firstName?: string;
    score: number;
    topics: { topicTitle: string; ruleDescription: string }[];
}

export interface DraftPlanPromptContext {
    firstName?: string;
    score: number;
    runLabel: string;
    missed: { text: string; difficulty: 'beginner' | 'intermediate' | 'advanced' }[];
}

export interface QuestionPromptContext {
    categoryName: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    count: number;
}

export interface FeedbackPromptContext {
    firstName?: string;
    score: number;
    weakAreas: string[];
}

/** Matches feedbackResponseSchema's upper bound, with room for the model to overshoot. */
const FEEDBACK_MAX_CHARS = 500;

/** What each band is meant to test. Mirrors how the baseline paper is built. */
const DIFFICULTY_BRIEF = {
    beginner: 'definitions and core vocabulary someone would meet in their first week',
    intermediate: 'applying the ideas, and knowing when one applies rather than another',
    advanced: 'trade-offs, edge cases, and failure modes a practitioner would recognise',
} as const;

/** Matches enhancedPlanItemSchema's bound, with room for the model to overshoot. */
const PLAN_ITEM_MAX_CHARS = 400;

/**
 * SP-091's prompt.
 *
 * The rule text is sent WITH each topic, and the model is told not to repeat
 * it. That is the difference between "AI decorates" and "AI replaces": without
 * the rule text in the prompt, the model writes its own version of advice the
 * page is already showing, and the member reads the same thing twice.
 */
export function buildEnhancePlanPrompt(context: PlanPromptContext): string {
    const student = context.firstName ? `${context.firstName}, a student,` : 'A student';

    const topics = context.topics
        .map((topic) => `- "${topic.topicTitle}": already told "${topic.ruleDescription}"`)
        .join('\n');

    return (
        `${student} scored ${context.score}% on a skills assessment and has a study plan ` +
        `covering these topics:\n${topics}\n\n` +
        `For each topic, write one short paragraph saying why it matters for THIS student ` +
        `given that score, and what changes once they have it. ` +
        `Do not repeat the advice already quoted above and do not invent topics. ` +
        `Keep each paragraph under ${PLAN_ITEM_MAX_CHARS} characters. ` +
        `Reply with JSON only, in the shape ` +
        `{"items": [{"topicTitle": string, "aiDescription": string}]}, and nothing else. ` +
        `Echo each topicTitle back exactly as it appears above.`
    );
}

/**
 * The drafting prompt — a plan out of missed questions alone.
 *
 * The one place in this file where the model is asked to DECIDE something
 * rather than to elaborate a decision already made, and the reason is that
 * there is no decision to elaborate: a bank with no `topic_title` on it gives
 * the rules nothing to group by, so the alternative to this prompt is an empty
 * plan page after a graded run.
 *
 * Three instructions carry the weight:
 *
 *  1. GROUP, do not translate. One topic per question would be a list of the
 *     paper read back to the member, which the results page already shows.
 *  2. Do not quote or answer the questions. The advice has to be about the
 *     topic, or a plan item becomes an answer key for the retake.
 *  3. Echo a difficulty per topic, so urgency stays the rules' scale rather
 *     than the model's opinion — the service maps it, the model never sees a
 *     priority number.
 *
 * MAX_DRAFTED_TOPICS is stated in the prompt as well as enforced by the schema.
 * A model told nothing will happily return one topic per question on a
 * twenty-question paper, and a plan of twenty items is a plan nobody starts.
 */
export function buildDraftPlanPrompt(context: DraftPlanPromptContext): string {
    const student = context.firstName ? `${context.firstName}, a student,` : 'A student';

    const missed = context.missed
        .map((question) => `- (${question.difficulty}) ${question.text}`)
        .join('\n');

    return (
        `${student} scored ${context.score}% on their ${context.runLabel} and got these ` +
        `questions wrong:\n${missed}\n\n` +
        `Work out what those questions have in common and give them at most ` +
        `${MAX_DRAFTED_TOPICS} study topics, naming each in two to five words. ` +
        `Questions that test the same thing share one topic. ` +
        `For each topic write one paragraph addressed to the student saying what to study ` +
        `and why it matters at this score, under ${PLAN_ITEM_MAX_CHARS} characters. ` +
        `Do not quote the questions, do not answer them, and do not add a topic that none ` +
        `of them tests. ` +
        `Give each topic the difficulty of the questions it came from. ` +
        `Reply with JSON only, in the shape ` +
        `{"items": [{"topicTitle": string, "difficulty": "beginner" | "intermediate" | ` +
        `"advanced", "description": string}]}, and nothing else.`
    );
}

/**
 * SP-092's prompt.
 *
 * The difficulty is spelled out rather than named, because "advanced" means
 * whatever the model decides it means and the three bands here have a job: a
 * baseline paper is 7 beginner, 7 intermediate and 6 advanced, and a band that
 * drifts makes the level a member is placed at drift with it.
 */
export function buildGenerateQuestionsPrompt(context: QuestionPromptContext): string {
    return (
        `Write exactly ${context.count} multiple-choice questions about ` +
        `"${context.categoryName}", at ${context.difficulty} level ` +
        `(${DIFFICULTY_BRIEF[context.difficulty]}).\n\n` +
        `Each question needs 4 options: exactly one correct, three that are wrong but ` +
        `plausible to someone who half-knows the material. All four must be distinct, and ` +
        `none may say "all of the above" or "none of the above". ` +
        `correctAnswer must repeat one option verbatim. ` +
        `Do not number the questions or reference "the above".\n\n` +
        `Also give each question a topicTitle — two to five words naming what it ` +
        `tests, reused verbatim across questions that test the same thing — and a ` +
        `studyAdvice sentence saying what to reread after missing it. Those two are ` +
        `what a member's study plan is built from, so the advice must be about the ` +
        `topic and never about the specific question.\n\n` +
        `Reply with JSON only, an array of ` +
        `{"question": string, "options": string[], "correctAnswer": string, ` +
        `"topicTitle": string, "studyAdvice": string}, and nothing else.`
    );
}

/**
 * SP-093's prompt.
 *
 * The weak areas are the whole point: "not generic praise" is an acceptance
 * criterion, so the list is stated as fact and the model is told to name them.
 * Plain text out, not JSON — the answer IS the string, and asking a model to
 * wrap one sentence in an object is a parse failure waiting to happen.
 */
export function buildFeedbackPrompt(context: FeedbackPromptContext): string {
    const student = context.firstName ? `${context.firstName}, a student,` : 'A student';
    const weakAreas =
        context.weakAreas.length > 0 ? context.weakAreas.join(', ') : 'no clearly weak area';

    return (
        `${student} scored ${context.score}% on a skills assessment. ` +
        `The areas they got wrong are: ${weakAreas}. ` +
        `Write two or three sentences of encouraging, specific feedback addressed to them. ` +
        `Name those areas explicitly and say what to do about them. ` +
        `Do not invent results you were not given, do not praise generically, ` +
        `and do not exceed ${FEEDBACK_MAX_CHARS} characters. ` +
        `Reply with the feedback text only — no preamble, no quotes, no markdown.`
    );
}
