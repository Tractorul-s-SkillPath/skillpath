/**
 * Tests for lib/ai/mock.ts.
 *
 * Story: SP-090
 *
 * Cases
 *  - deterministic: same input twice -> identical output
 *  - its output passes the Zod schemas in lib/ai/schemas.ts (a fixture that
 *    would not survive validation is a fixture that hides bugs)
 *  - the injectable failure modes really do throw / hang / return malformed data
 *
 * WHY DETERMINISM IS TESTED AND NOT ASSUMED. This provider is what every CI run
 * and every demo actually renders, and SP-093 promises a member that the same
 * result always shows the same text. An earlier draft of mock.ts picked its
 * message with Math.random(), which made the feature look right on one refresh
 * and wrong on the next. The `toEqual` pairs below are what stop that coming
 * back.
 */

import { describe, expect, it, vi } from 'vitest';
import { mockProvider } from '../../../lib/ai/mock';
import {
    draftQuestionsSchema,
    enhancedPlanSchema,
    feedbackResponseSchema,
} from '../../../lib/ai/schemas';

const A_PLAN = {
    firstName: 'Ana',
    score: 62,
    topics: [
        { topicTitle: 'Indexes', ruleDescription: 'Read up on B-trees.' },
        { topicTitle: 'Joins', ruleDescription: 'Practise inner versus outer.' },
    ],
};

const A_SPEC = { categoryName: 'Databases', difficulty: 'intermediate' as const, count: 3 };

const A_FEEDBACK = { firstName: 'Ana', score: 62, weakAreas: ['Indexes', 'Joins'] };

describe('determinism — the whole contract', () => {
    it('returns byte-identical feedback for the same input', async () => {
        expect(await mockProvider.feedback(A_FEEDBACK)).toBe(
            await mockProvider.feedback(A_FEEDBACK),
        );
    });

    it('returns byte-identical plans and questions for the same input', async () => {
        expect(await mockProvider.enhancePlan(A_PLAN)).toEqual(
            await mockProvider.enhancePlan(A_PLAN),
        );
        expect(await mockProvider.generateQuestions(A_SPEC)).toEqual(
            await mockProvider.generateQuestions(A_SPEC),
        );
    });

    it('does not read the clock', async () => {
        // The other half of determinism. A fixture seeded by Date.now() would
        // pass the two tests above inside one millisecond and fail overnight.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
        const early = await mockProvider.feedback(A_FEEDBACK);

        vi.setSystemTime(new Date('2031-06-15T12:34:56Z'));
        const late = await mockProvider.feedback(A_FEEDBACK);
        vi.useRealTimers();

        expect(early).toBe(late);
    });

    it('says different things about different inputs', async () => {
        // Determinism is not "one constant". A mock that returned the same
        // sentence for every score would satisfy every test above and make the
        // feature look broken in a demo.
        const low = await mockProvider.feedback({ ...A_FEEDBACK, score: 20 });
        const high = await mockProvider.feedback({ ...A_FEEDBACK, score: 95 });

        expect(low).not.toBe(high);
    });

    it('gives each plan row its own note rather than repeating one', async () => {
        // "A plan of six items reads as six different notes rather than the
        // same sentence six times."
        const plan = await mockProvider.enhancePlan({
            ...A_PLAN,
            topics: [
                { topicTitle: 'Indexes', ruleDescription: 'a' },
                { topicTitle: 'Joins', ruleDescription: 'b' },
                { topicTitle: 'Transactions', ruleDescription: 'c' },
            ],
        });

        const notes = new Set(plan.items.map((item) => item.aiDescription));
        expect(notes.size).toBe(3);
    });
});

describe('the fixtures survive the boundary they will be parsed at', () => {
    it('produces a plan that enhancedPlanSchema accepts', async () => {
        // A fixture that would not survive validation is a fixture that hides
        // bugs: every service test would be exercising the degradation path
        // while claiming to exercise the happy one.
        const plan = await mockProvider.enhancePlan(A_PLAN);

        expect(enhancedPlanSchema.safeParse(plan).success).toBe(true);
    });

    it('produces questions that draftQuestionsSchema accepts', async () => {
        const drafts = await mockProvider.generateQuestions(A_SPEC);

        expect(draftQuestionsSchema.safeParse(drafts).success).toBe(true);
    });

    it('produces feedback that feedbackResponseSchema accepts', async () => {
        const feedback = await mockProvider.feedback(A_FEEDBACK);

        expect(feedbackResponseSchema.safeParse(feedback).success).toBe(true);
    });

    it('produces feedback inside the bound for every score in range', async () => {
        // total_score is 0-100 by database constraint, so this is the whole
        // input domain for the branch that picks a message.
        for (const score of [0, 1, 49, 50, 79, 80, 99, 100]) {
            const feedback = await mockProvider.feedback({ ...A_FEEDBACK, score });

            expect(feedbackResponseSchema.safeParse(feedback).success, `score ${score}`).toBe(true);
        }
    });

    it('echoes each topic title back exactly, the way a well-behaved model would', async () => {
        // ai.service matches on this title. "A mock that paraphrased would hide
        // the matching bug rather than exercise it."
        const plan = await mockProvider.enhancePlan(A_PLAN);

        expect(plan.items.map((item) => item.topicTitle)).toEqual(['Indexes', 'Joins']);
    });

    it('returns the full count that was asked for, not a capped three', async () => {
        // "A generator that quietly returns fewer makes the count control a
        // lie." The service caps what may be REQUESTED; this honours it.
        const drafts = await mockProvider.generateQuestions({ ...A_SPEC, count: 8 });

        expect(drafts).toHaveLength(8);
    });

    it('gives distinct options across questions as well as within one', async () => {
        const drafts = await mockProvider.generateQuestions({ ...A_SPEC, count: 4 });
        const everyOption = drafts.flatMap((draft) => draft.options);

        expect(new Set(everyOption).size).toBe(everyOption.length);
    });

    it('handles a zero count without producing a negative-length array', async () => {
        await expect(mockProvider.generateQuestions({ ...A_SPEC, count: 0 })).resolves.toEqual([]);
        await expect(mockProvider.generateQuestions({ ...A_SPEC, count: -5 })).resolves.toEqual([]);
    });

    it('prefixes the name when there is one and omits it when there is not', async () => {
        const named = await mockProvider.feedback(A_FEEDBACK);
        const anonymous = await mockProvider.feedback({ ...A_FEEDBACK, firstName: undefined });

        expect(named.startsWith('Ana — ')).toBe(true);
        expect(anonymous).not.toContain('undefined');
        expect(anonymous.startsWith('Ana')).toBe(false);
    });
});

describe('the injectable failure modes', () => {
    it('throws on the "throw" sentinel in each method', async () => {
        await expect(
            mockProvider.enhancePlan({
                ...A_PLAN,
                topics: [{ topicTitle: 'throw', ruleDescription: 'x' }],
            }),
        ).rejects.toThrow(/throw mode/);

        await expect(
            mockProvider.generateQuestions({ ...A_SPEC, categoryName: 'throw' }),
        ).rejects.toThrow(/forced error/);

        await expect(mockProvider.feedback({ ...A_FEEDBACK, score: -1 })).rejects.toThrow(
            /forced feedback error/,
        );
    });

    it('never settles on the "hang" sentinel, so a timeout test has something to race', async () => {
        const sentinel = Symbol('still pending');
        const settledOrNot = (work: Promise<unknown>) =>
            Promise.race([
                work.then(() => 'settled'),
                new Promise((resolve) => setTimeout(() => resolve(sentinel), 20)),
            ]);

        await expect(
            settledOrNot(
                mockProvider.enhancePlan({
                    ...A_PLAN,
                    topics: [{ topicTitle: 'hang', ruleDescription: 'x' }],
                }),
            ),
        ).resolves.toBe(sentinel);

        await expect(
            settledOrNot(mockProvider.generateQuestions({ ...A_SPEC, categoryName: 'hang' })),
        ).resolves.toBe(sentinel);

        await expect(
            settledOrNot(mockProvider.feedback({ ...A_FEEDBACK, score: -99 })),
        ).resolves.toBe(sentinel);
    });

    it("returns SP-092 AC4's malformed draft, which the schema then rejects", async () => {
        const drafts = await mockProvider.generateQuestions({
            ...A_SPEC,
            categoryName: 'malformed',
        });

        // Shaped like an answer, and refused at the boundary because the key is
        // not one of the options. Both halves matter: if it did not parse as
        // JSON the test below would pass for the wrong reason.
        expect(drafts).toHaveLength(1);
        expect(draftQuestionsSchema.safeParse(drafts).success).toBe(false);
    });

    it('keeps every sentinel out of reach of real data', async () => {
        // "None is reachable from real data: a score is 0-100 by database
        // constraint, and no topic is named 'throw'." The -1 and -99 sentinels
        // sit outside the column's check constraint; this pins that the whole
        // legal range is safe.
        for (const score of [0, 50, 100]) {
            await expect(mockProvider.feedback({ ...A_FEEDBACK, score })).resolves.toEqual(
                expect.any(String),
            );
        }
    });

    it('throws on the "throw" sentinel in draftPlan', async () => {
        await expect(
            mockProvider.draftPlan({
                firstName: 'Ana',
                score: 50,
                runLabel: 'throw',
                missed: [{ text: 'Error test', difficulty: 'beginner' }],
            }),
        ).rejects.toThrow(/throw mode/);
    });

    it('never settles on the "hang" sentinel in draftPlan', async () => {
        const sentinel = Symbol('still pending');
        const settledOrNot = (work: Promise<unknown>) =>
            Promise.race([
                work.then(() => 'settled'),
                new Promise((resolve) => setTimeout(() => resolve(sentinel), 20)),
            ]);

        await expect(
            settledOrNot(
                mockProvider.draftPlan({
                    firstName: 'Ana',
                    score: 50,
                    runLabel: 'hang',
                    missed: [{ text: 'Error test', difficulty: 'beginner' }],
                }),
            ),
        ).resolves.toBe(sentinel);
    });
});
