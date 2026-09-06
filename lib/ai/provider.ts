/**
 * The AI seam — one interface, two implementations, chosen by env var.
 *
 * Layer: AI
 * Stories: SP-090, SP-094
 *
 * Sketch
 *  AiProvider                  - enhancePlan / draftPlan / generateQuestions / feedback
 *  getProvider(): AiProvider   - reads AI_PROVIDER, defaults to 'mock'
 *
 * enhancePlan and draftPlan are two halves of one feature and NOT alternatives
 * to be collapsed. The first is shown topics the rules produced; the second is
 * shown the questions themselves, and is what a category whose bank carries no
 * `topic_title` gets instead of nothing at all.
 *
 * NO VENDOR APPEARS IN THIS FILE, and that is the point of it. The real
 * implementation talks to anything that speaks `POST /chat/completions`, which
 * is every hosted API worth naming and every local runtime — so choosing a
 * vendor is three environment variables (AI_BASE_URL, AI_API_KEY, AI_MODEL)
 * rather than a second implementation of this interface.
 *
 * `mock` is the default everywhere it is not set, and is pinned in tests and CI
 * (ARCHITECTURE §6): a broken API key must never block a teammate, and an
 * unknown value degrades to it with a warning rather than throwing at import
 * time, because a typo in an env var should not take the whole app down.
 *
 * All three features now have a caller: enhancePlan (SP-091) from
 * grading.service, feedback (SP-093) from the results page, generateQuestions
 * (SP-092) from question.service.
 *
 * Test: tests/lib/ai/provider.test.ts
 */

import { mockProvider } from './mock';
import { openAiCompatibleProvider } from './openai-compatible';
import type { SkillLevel } from '../domain/types';

/** One rule-generated plan row, as the model is shown it. */
export interface PlanTopic {
    topicTitle: string;
    /** The rule text already on the row. The AI adds to it, never replaces it. */
    ruleDescription: string;
}

/**
 * What an enhancement prompt is allowed to know (SP-091, SP-094).
 *
 * The same discipline as FeedbackContext: a first name, a score, and what the
 * member got wrong. There is no field for an email, a surname or a user id, so
 * a caller cannot leak one by accident.
 */
export interface PlanContext {
    firstName?: string;
    score: number;
    topics: PlanTopic[];
}

/** The model's answer, one entry per topic it had something to say about. */
export interface EnhancedPlanItem {
    /** Echoed back so the service can match it to a row. Unmatched titles are dropped. */
    topicTitle: string;
    aiDescription: string;
}

export interface EnhancedPlan {
    items: EnhancedPlanItem[];
}

/** One question the member got wrong, as a DRAFTING prompt is shown it. */
export interface DraftPlanQuestion {
    text: string;
    difficulty: SkillLevel;
}

/**
 * What a plan the rules could not write is drafted from (SP-060 fallback).
 *
 * THE DIFFERENCE FROM PlanContext IS THE WHOLE FEATURE. That one is shown
 * topics that already exist and asked to elaborate them; this one is shown the
 * QUESTIONS and asked to name the topics itself, because a question bank whose
 * `topic_title` was never filled in gives the rules nothing to group by. Same
 * discipline about what it may know: a first name, a score, a phrase naming the
 * run, and the question text — no email, no surname, no user id, no ids at all.
 *
 * The question text is admin-authored free text, like a category name, and it
 * is DATA here exactly as those are: echoed into prose we render, never into a
 * later prompt and never into a code path.
 */
export interface DraftPlanContext {
    firstName?: string;
    score: number;
    /** Completes "…in your ___." — "SQL assessment", never a category id. */
    runLabel: string;
    missed: DraftPlanQuestion[];
}

/**
 * One topic the model made up out of the questions it was shown.
 *
 * `difficulty` is asked for so urgency stays the rules' decision rather than
 * the model's: the service maps it through the same PRIORITY_BY_DIFFICULTY
 * table a rule-built row goes through, so a beginner gap outranks an advanced
 * one whoever wrote the row.
 */
export interface DraftedPlanItem {
    topicTitle: string;
    difficulty: SkillLevel;
    description: string;
}

export interface DraftedPlan {
    items: DraftedPlanItem[];
}

/**
 * What an admin asks for (SP-092 AC1): a category, a difficulty and a count.
 *
 * The CATEGORY NAME, not its id. A database id means nothing to a model and
 * everything to this application — sending one out invites a plausible-looking
 * number back, and the row it points at is not something model output gets to
 * choose. The service maps the name to the id it already had.
 */
export interface GenSpec {
    categoryName: string;
    difficulty: SkillLevel;
    count: number;
}

/**
 * One generated question, in the model's own vocabulary.
 *
 * Deliberately NOT `QuestionInput`. This is the shape that arrives; turning it
 * into something the question bank will accept is the service's job, and it
 * involves re-validating against the very same schema the admin form uses.
 */
export interface DraftQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    /** Optional, and only useful as a pair — see draftQuestionSchema. */
    topicTitle?: string;
    studyAdvice?: string;
}

/**
 * Everything a feedback prompt is allowed to know about a member.
 *
 * SP-094 is enforced by this shape as much as by scrubContext: there is no
 * field here for an email, a surname or a user id, so a caller cannot pass one
 * by accident. `weakAreas` comes from weakAreasFromReview in lib/domain.
 */
export interface FeedbackContext {
    firstName?: string;
    score: number;
    weakAreas: string[];
}

export interface AiProvider {
    enhancePlan(input: PlanContext): Promise<EnhancedPlan>;
    draftPlan(input: DraftPlanContext): Promise<DraftedPlan>;
    generateQuestions(input: GenSpec): Promise<DraftQuestion[]>;
    feedback(input: FeedbackContext): Promise<string>;
}

/**
 * What every provider failure arrives as, whatever caused it.
 *
 * A timeout, a 500, a missing key and a generation that will not parse are one
 * condition as far as a caller is concerned — "there is no usable AI text right
 * now" — and the caller's answer is always the same: log it and use the
 * rule-based path. Collapsing them here is what stops a raw `SyntaxError` from
 * JSON.parse reaching a page (§6.1).
 */
export class AiUnavailableError extends Error {
    readonly code = 'ai_unavailable' as const;

    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'AiUnavailableError';
    }
}

export function getProvider(): AiProvider {
    const requested = (process.env.AI_PROVIDER ?? 'mock').trim().toLowerCase();

    switch (requested) {
        case '':
        case 'mock':
            return mockProvider;

        // Every non-mock value means the same implementation. The name is kept
        // as a word rather than a boolean because it reads as a choice in a
        // deployment config, and because `AI_PROVIDER=openai` next to
        // `AI_BASE_URL=https://api.groq.com/openai/v1` says the true thing:
        // the PROTOCOL is OpenAI's, the vendor is whatever the URL points at.
        case 'openai':
        case 'openai-compatible':
            return openAiCompatibleProvider;

        default:
            console.warn(
                `[ai] unknown AI_PROVIDER "${requested}" — falling back to the mock provider.`,
            );
            return mockProvider;
    }
}
