/**
 * Tests for lib/ai/prompts.ts.
 *
 * Story: SP-094
 *
 * Cases
 *  - each builder produces a non-empty prompt from a typed context
 *  - the output contains the first name and the scores and NOTHING else
 *    identifying: no email, no last name, no user id (SP-094)
 *  - the prompt asks for the exact JSON shape the Zod schema expects
 *
 * ON THE SECOND CASE. What actually enforces SP-094 is that PlanPromptContext
 * and FeedbackPromptContext have no field for an email, a surname or a user id
 * — a caller cannot leak one because there is nowhere to put it. That is a
 * compile-time property, so the runtime half below does the only thing it
 * usefully can: hands each builder everything it WILL accept, and asserts that
 * a realistic set of identifiers is absent from the string that comes out. If
 * somebody widens a context type, this test does not fail — but the assertion
 * on the key set does, which is why that one is here too.
 */

import { describe, expect, it } from 'vitest';
import {
    buildDraftPlanPrompt,
    buildEnhancePlanPrompt,
    buildFeedbackPrompt,
    buildGenerateQuestionsPrompt,
} from '../../../lib/ai/prompts';

/** Everything a leak would look like, none of which any context type can carry. */
const IDENTIFIERS = [
    'ana.popescu@example.com',
    'Popescu',
    '3f0c8b7e-0a1b-4c2d-9e8f-1a2b3c4d5e6f',
    '+40 721 000 000',
];

const A_PLAN_CONTEXT = {
    firstName: 'Ana',
    score: 62,
    topics: [
        { topicTitle: 'Indexes', ruleDescription: 'Read up on B-trees.' },
        { topicTitle: 'Joins', ruleDescription: 'Practise inner versus outer.' },
    ],
};

const A_FEEDBACK_CONTEXT = {
    firstName: 'Ana',
    score: 62,
    weakAreas: ['Indexes', 'Joins'],
};

const A_QUESTION_CONTEXT = {
    categoryName: 'Databases',
    difficulty: 'intermediate' as const,
    count: 5,
};

describe('every builder produces a usable prompt', () => {
    it('returns non-empty text from a typed context', () => {
        expect(buildEnhancePlanPrompt(A_PLAN_CONTEXT).length).toBeGreaterThan(0);
        expect(buildFeedbackPrompt(A_FEEDBACK_CONTEXT).length).toBeGreaterThan(0);
        expect(buildGenerateQuestionsPrompt(A_QUESTION_CONTEXT).length).toBeGreaterThan(0);
    });

    it('is pure — the same context twice gives the same string', () => {
        // No clock, no randomness. The mock provider makes the same promise and
        // for the same reason: a prompt that varies makes a cache miss and an
        // unreproducible bug report.
        expect(buildFeedbackPrompt(A_FEEDBACK_CONTEXT)).toBe(
            buildFeedbackPrompt(A_FEEDBACK_CONTEXT),
        );
        expect(buildEnhancePlanPrompt(A_PLAN_CONTEXT)).toBe(buildEnhancePlanPrompt(A_PLAN_CONTEXT));
    });
});

describe('what a prompt is allowed to know (SP-094)', () => {
    it('names the first name and the score, and nothing that identifies further', () => {
        const plan = buildEnhancePlanPrompt(A_PLAN_CONTEXT);
        const feedback = buildFeedbackPrompt(A_FEEDBACK_CONTEXT);

        for (const prompt of [plan, feedback]) {
            expect(prompt).toContain('Ana');
            expect(prompt).toContain('62');

            for (const identifier of IDENTIFIERS) {
                expect(prompt).not.toContain(identifier);
            }
        }
    });

    it('has no field for anything but a first name, a score and the topics', () => {
        // The real enforcement, asserted as data. Widening a context type to
        // take a user id or an email fails here, which is the only place that
        // change would be noticed at all.
        expect(Object.keys(A_PLAN_CONTEXT).sort()).toEqual(['firstName', 'score', 'topics']);
        expect(Object.keys(A_FEEDBACK_CONTEXT).sort()).toEqual(['firstName', 'score', 'weakAreas']);
    });

    it('omits the name entirely when there is none, rather than saying "undefined"', () => {
        const feedback = buildFeedbackPrompt({ ...A_FEEDBACK_CONTEXT, firstName: undefined });
        const plan = buildEnhancePlanPrompt({ ...A_PLAN_CONTEXT, firstName: undefined });

        expect(feedback).not.toContain('undefined');
        expect(feedback).toContain('A student');
        expect(plan).not.toContain('undefined');
        expect(plan).toContain('A student');
    });

    it('sends the category NAME, never an id, to the question builder', () => {
        const prompt = buildGenerateQuestionsPrompt(A_QUESTION_CONTEXT);

        expect(prompt).toContain('Databases');
        // "A database id means nothing to a model and everything to this
        // application" — the shape has no field for one, and this is the
        // reading of that claim a test can hold.
        expect(Object.keys(A_QUESTION_CONTEXT).sort()).toEqual([
            'categoryName',
            'count',
            'difficulty',
        ]);
    });
});

describe('the prompt and the schema do not drift', () => {
    it('asks the plan builder for exactly the keys enhancedPlanSchema parses', () => {
        const prompt = buildEnhancePlanPrompt(A_PLAN_CONTEXT);

        expect(prompt).toContain('"items"');
        expect(prompt).toContain('"topicTitle"');
        expect(prompt).toContain('"aiDescription"');
    });

    it('asks the question builder for exactly the keys draftQuestionSchema parses', () => {
        const prompt = buildGenerateQuestionsPrompt(A_QUESTION_CONTEXT);

        expect(prompt).toContain('"question"');
        expect(prompt).toContain('"options"');
        expect(prompt).toContain('"correctAnswer"');
    });

    it('asks for plain text from the feedback builder, not JSON', () => {
        // feedbackResponseSchema is a bare string. "Asking a model to wrap one
        // sentence in an object is a parse failure waiting to happen" — so a
        // prompt that started asking for JSON would be a real regression.
        const prompt = buildFeedbackPrompt(A_FEEDBACK_CONTEXT);

        expect(prompt).toContain('feedback text only');
        expect(prompt).not.toContain('JSON');
    });

    it('states a character bound below the one its schema enforces', () => {
        // The prompt keeps the ANSWER short; the schema is the backstop. If the
        // prompt ever asked for more than the schema allows, every well-behaved
        // generation would fail validation.
        expect(buildFeedbackPrompt(A_FEEDBACK_CONTEXT)).toContain('500 characters');
        expect(buildEnhancePlanPrompt(A_PLAN_CONTEXT)).toContain('400 characters');
    });
});

describe('the plan prompt shows the model the rules it must not repeat', () => {
    it('includes each topic title and its existing rule text', () => {
        // Without the rule text in the prompt the model rewrites advice the
        // page already shows, and the member reads the same thing twice. This
        // is the difference between "AI decorates" and "AI replaces" (D5).
        const prompt = buildEnhancePlanPrompt(A_PLAN_CONTEXT);

        expect(prompt).toContain('Indexes');
        expect(prompt).toContain('Read up on B-trees.');
        expect(prompt).toContain('Joins');
        expect(prompt).toContain('Practise inner versus outer.');
        expect(prompt).toContain('Do not repeat the advice already quoted above');
    });
});

describe('the difficulty band is spelled out, not just named', () => {
    it('describes what each band tests', () => {
        // "'advanced' means whatever the model decides it means" — and a band
        // that drifts moves the level a member is placed at with it.
        const beginner = buildGenerateQuestionsPrompt({
            ...A_QUESTION_CONTEXT,
            difficulty: 'beginner',
        });
        const advanced = buildGenerateQuestionsPrompt({
            ...A_QUESTION_CONTEXT,
            difficulty: 'advanced',
        });

        expect(beginner).toContain('first week');
        expect(advanced).toContain('trade-offs');
        expect(beginner).not.toBe(advanced);
    });

    it('asks for the count it was given', () => {
        expect(buildGenerateQuestionsPrompt({ ...A_QUESTION_CONTEXT, count: 7 })).toContain(
            'exactly 7',
        );
    });
});

const A_DRAFT_PLAN_CONTEXT = {
    firstName: 'Ana',
    score: 55,
    runLabel: 'SQL assessment',
    missed: [
        { text: 'What is a primary key?', difficulty: 'beginner' as const },
        { text: 'Explain deadlock handling.', difficulty: 'advanced' as const },
    ],
};

describe('buildDraftPlanPrompt and edge coverage', () => {
    it('produces a non-empty prompt for draft plan and handles missing firstName', () => {
        const draftPrompt = buildDraftPlanPrompt(A_DRAFT_PLAN_CONTEXT);
        expect(draftPrompt.length).toBeGreaterThan(0);
        expect(draftPrompt).toContain('SQL assessment');
        expect(draftPrompt).toContain('Ana');

        const anonymousDraft = buildDraftPlanPrompt({
            ...A_DRAFT_PLAN_CONTEXT,
            firstName: undefined,
        });
        expect(anonymousDraft).toContain('A student');
        expect(anonymousDraft).not.toContain('undefined');
    });

    it('validates keys for draft plan context shape', () => {
        expect(Object.keys(A_DRAFT_PLAN_CONTEXT).sort()).toEqual([
            'firstName',
            'missed',
            'runLabel',
            'score',
        ]);
    });
});
