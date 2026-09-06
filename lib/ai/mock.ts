/**
 * The mock provider — the default everywhere, and the only one CI ever sees.
 *
 * Layer: AI
 * Story: SP-090
 *
 * Sketch
 *  mockProvider: AiProvider   - deterministic fixtures, plus injectable failures
 *
 * DETERMINISTIC IS THE WHOLE CONTRACT. Same input twice, byte-identical output.
 * That is not a testing nicety here: SP-093 promises a member that the same
 * result always shows the same text, and the mock is what a demo and every CI
 * run actually renders. An earlier draft of this file picked its message with
 * Math.random(), which made the feature look right on one refresh and wrong on
 * the next. Nothing below may call Math.random() or read the clock.
 *
 * The failure modes are triggered by sentinel inputs rather than by wiring, so
 * a service test can exercise "the provider is down" without a mocking library
 * and without a second fake provider to keep in sync. None is reachable from
 * real data: a score is 0-100 by database constraint, and no topic is named
 * "throw".
 *
 * Test: tests/lib/ai/mock.test.ts
 */

import { estimateLevel } from '../domain/levels';
import type { SkillLevel } from '../domain/types';
import type {
    AiProvider,
    PlanContext,
    EnhancedPlan,
    DraftPlanContext,
    DraftedPlan,
    GenSpec,
    DraftQuestion,
    FeedbackContext,
} from './provider';

/**
 * FNV-1a, 32-bit. Any stable string-to-number would do; this one is four lines
 * and has no dependencies. It exists so "pick one of three messages" can depend
 * on the input instead of on chance.
 */
function hash(input: string): number {
    let value = 0x811c9dc5;

    for (let i = 0; i < input.length; i++) {
        value ^= input.charCodeAt(i);
        value = Math.imul(value, 0x01000193);
    }

    return value >>> 0;
}

/** Same input -> same element, every time, on every machine. */
function pick<T>(pool: readonly T[], seed: string): T {
    return pool[hash(seed) % pool.length];
}

/**
 * SP-091's fixtures. One per plan row, seeded by the topic, so a plan of six
 * items reads as six different notes rather than the same sentence six times —
 * and reads the same way on every refresh and on every machine.
 */
const PLAN_NOTES = [
    (score: number, topic: string) =>
        `At ${score}% this is the gap that costs you the most marks. ${topic} sits underneath several of the questions you missed, so time here pays for itself twice.`,
    (score: number, topic: string) =>
        `Worth doing before anything harder: ${topic} is assumed knowledge in the questions further up the paper, and a ${score}% run suggests it is being assumed too early.`,
    (score: number, topic: string) =>
        `You lost marks here rather than guessing wrong elsewhere. Getting ${topic} solid is what turns ${score}% into a run where the hard questions are the only ones left.`,
] as const;

/**
 * What the mock calls the topics it drafts. Three fixed names rather than
 * something derived from the question text: a topic title is written into a
 * column with a 2-200 character check on it, and a mock that echoed free text
 * would put whatever a test happened to type into that column.
 */
const DRAFTED_TOPICS: Record<SkillLevel, string> = {
    beginner: 'Core concepts',
    intermediate: 'Applying the concepts',
    advanced: 'Trade-offs and edge cases',
};

const LOW_SCORE_MESSAGES = [
    (score: number, areas: string) =>
        `Scoring ${score}% is the starting point of this, not the verdict on it. Put your next few sessions into ${areas} and take the assessment again — that is where the marks are.`,
    (score: number, areas: string) =>
        `A ${score}% run tells you exactly where to look, which is more than a good score would have. Go back through ${areas} one topic at a time, then come back to this.`,
    (score: number, areas: string) =>
        `${score}% now. Take the fundamentals of ${areas} slowly — every question you missed came from there — and the next attempt will not look like this one.`,
] as const;

const MID_SCORE_MESSAGES = [
    (score: number, areas: string) =>
        `${score}% says the core ideas are already yours. What is standing between you and the top band is ${areas}, so spend your next session there rather than starting something new.`,
    (score: number, areas: string) =>
        `Solid work at ${score}%. You are past the stage of relearning everything — tighten up ${areas} and the rest of it holds.`,
    (score: number, areas: string) =>
        `A ${score}% result with a clear shape to it: you understand the material and you lose marks in ${areas}. Fix that one thing and this becomes a strong score.`,
] as const;

const HIGH_SCORE_MESSAGES = [
    (score: number, areas: string) =>
        `${score}% is a strong result and there is not much left to shore up. Push into the harder end of ${areas}, where the last few marks live.`,
    (score: number, areas: string) =>
        `Excellent — ${score}%. Keep the routine that got you here, and use ${areas} as the place to stretch rather than to repair.`,
    (score: number, areas: string) =>
        `At ${score}% you have this. ${areas} is the only place the paper found daylight, so make that the next thing you go deep on.`,
] as const;

export const mockProvider: AiProvider = {
    async enhancePlan(input: PlanContext): Promise<EnhancedPlan> {
        if (input.topics.some((topic) => topic.topicTitle === 'throw')) {
            throw new Error('Mock provider forced error (throw mode)');
        }
        if (input.topics.some((topic) => topic.topicTitle === 'hang')) {
            await new Promise(() => {});
        }

        const score = Math.round(input.score);

        return {
            items: input.topics.map((topic) => ({
                // Echoed exactly, the way a well-behaved model would — the
                // service matches on this, so a mock that paraphrased would
                // hide the matching bug rather than exercise it.
                topicTitle: topic.topicTitle,
                aiDescription: pick(PLAN_NOTES, `${score}|${topic.topicTitle}`)(
                    score,
                    topic.topicTitle,
                ),
            })),
        };
    },

    async draftPlan(input: DraftPlanContext): Promise<DraftedPlan> {
        if (input.runLabel === 'throw') {
            throw new Error('Mock provider forced error (throw mode)');
        }
        if (input.runLabel === 'hang') {
            await new Promise(() => {});
        }

        const score = Math.round(input.score);

        // ONE TOPIC PER BAND THE PAPER ACTUALLY MISSED, in beginner -> advanced
        // order. A mock that invented a topic per question would never produce
        // the case the service exists to handle — several questions collapsing
        // into one topic — and would make a twenty-question run render a
        // twenty-item plan in every demo and every E2E run.
        const bands: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

        return {
            items: bands
                .filter((band) => input.missed.some((question) => question.difficulty === band))
                .map((band) => {
                    const topicTitle = DRAFTED_TOPICS[band];

                    return {
                        topicTitle,
                        difficulty: band,
                        // The same pool the enhancement fixtures use, seeded the
                        // same way: a drafted plan and an enhanced one should
                        // read alike, because to a member they are one feature.
                        description: pick(PLAN_NOTES, `${score}|${topicTitle}`)(score, topicTitle),
                    };
                }),
        };
    },

    async generateQuestions(spec: GenSpec): Promise<DraftQuestion[]> {
        if (spec.categoryName === 'throw') {
            throw new Error('Mock provider forced error for questions');
        }
        if (spec.categoryName === 'hang') {
            await new Promise(() => {});
        }
        if (spec.categoryName === 'malformed') {
            // SP-092 AC4's input: shaped like an answer, rejected by the Zod
            // boundary because the correct answer is not one of the options.
            return [
                {
                    question: 'A question whose key does not match its options?',
                    options: ['Choice A', 'Choice B'],
                    correctAnswer: 'Choice Z',
                },
            ];
        }

        // The full count, not a capped three: the admin asked for a number and
        // a generator that quietly returns fewer makes the count control a lie.
        // The service caps what may be asked for; this honours it.
        return Array.from({ length: Math.max(0, spec.count) }, (_, index) => {
            const correct = `${spec.categoryName} answer ${index + 1}`;

            return {
                question: `Draft ${spec.difficulty} question ${index + 1} about ${spec.categoryName}?`,
                // Distinct per question as well as within it — two drafts that
                // shared an option set would look right and read as a bug.
                options: [
                    correct,
                    `A plausible ${spec.difficulty} distractor (${index + 1}a)`,
                    `A second distractor (${index + 1}b)`,
                    `A third distractor (${index + 1}c)`,
                ],
                correctAnswer: correct,
                // One topic for every draft in a run, on purpose: the collapse
                // rule in buildPlanRecommendations is only exercised when two
                // missed questions share a topic, and a mock that gives each
                // its own would never produce that case in an E2E run.
                topicTitle: `${spec.categoryName} fundamentals`,
                studyAdvice: `Reread the ${spec.difficulty} material on ${spec.categoryName}.`,
            };
        });
    },

    async feedback(input: FeedbackContext): Promise<string> {
        if (input.score === -1) {
            throw new Error('Mock provider forced feedback error');
        }
        if (input.score === -99) {
            await new Promise(() => {});
        }

        const areas = input.weakAreas.length > 0 ? input.weakAreas.join(', ') : 'the fundamentals';

        // Same bands the rule-based fallback uses, from the same function, so
        // switching AI off does not change the tone a member is spoken to in.
        const POOLS = {
            advanced: HIGH_SCORE_MESSAGES,
            intermediate: MID_SCORE_MESSAGES,
            beginner: LOW_SCORE_MESSAGES,
        } as const;

        const pool = POOLS[estimateLevel(input.score)];

        // Seeded by everything the caller passed, so two different runs read
        // differently while one run reads the same way forever.
        const seed = `${input.firstName ?? ''}|${input.score}|${areas}`;
        const message = pick(pool, seed)(Math.round(input.score), areas);

        return input.firstName ? `${input.firstName} — ${message}` : message;
    },
};
