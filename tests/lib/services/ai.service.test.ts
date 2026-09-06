/**
 * Tests for lib/services/ai.service.ts.
 *
 * Stories: SP-090, SP-091, SP-092, SP-093, SP-094
 *
 * Cases
 *  - feedback is persisted, and the second call returns the stored text rather
 *    than calling the provider again (§6.4 — this is what makes "the same
 *    result always shows the same text" true)
 *  - the generated text is stored against the calling member, once
 *  - provider throws -> the rule-based fallback, logged, no exception escapes
 *  - provider hangs -> abandoned at the deadline, same fallback
 *  - provider returns nothing usable -> same again
 *  - AI disabled -> the fallback, the provider is never called, and NOTHING is
 *    written, so switching AI back on still generates properly (SP-093 AC3)
 *  - a failed write still returns the text — the member sees feedback either way
 *  - the rate limiter refuses a member who loops the page, and that degrades
 *    like every other failure rather than throwing (SP-094)
 *  - no prompt context carries anything beyond a first name, a score and the
 *    weak areas (SP-094)
 *
 * And for enhancePlan (SP-091), whose whole job is to be optional:
 *  - the elaboration lands on the rows the RULES produced, matched by topic
 *  - the model is shown the rule text, so it adds rather than repeats
 *  - a topic the model invented is dropped, never written
 *  - provider off, throwing, hanging, rate-limited, or a failed write — all
 *    leave a correct rule-based plan behind and report nothing written
 *
 * And for draftQuestions (SP-092), which unlike the other two REPORTS failure,
 * because an admin pressed a button and is owed an answer:
 *  - drafts come back as QuestionInputs, re-validated against the same schema
 *    the admin's own create form uses
 *  - a draft that would not survive that schema is dropped on its own, and the
 *    rest still come back
 *  - a generation with nothing usable in it is an error, not an empty success
 *  - provider off, throwing, hanging, rate-limited — all one sentence (AC4)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as planRepo from '../../../lib/repositories/plan.repo';
import * as provider from '../../../lib/ai/provider';
import { AI_TIMEOUT_MS } from '../../../lib/ai/guardrails';
import { buildFallbackFeedback } from '../../../lib/domain/feedback';
import type { ReviewItem } from '../../../lib/domain/types';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { MAX_DRAFTED_TOPICS } from '../../../lib/ai/schemas';
import {
    draftPlan,
    draftQuestions,
    enhancePlan,
    feedbackFor,
    type FeedbackSubject,
    type PlanDraftSubject,
} from '../../../lib/services/ai.service';

vi.mock('../../../lib/repositories/assessment.repo');
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/ai/provider');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));

const RUN_ID = 500;

/**
 * A fresh member per test.
 *
 * The rate limiter in lib/ai/guardrails.ts holds module state that no test can
 * reset, so reusing one id would make the eleventh generation in this file fail
 * for a reason the test is not about. A new id per test is also the honest
 * shape: these are independent members.
 */
let members = 0;
const nextMember = () => `member-${++members}`;

let feedback: ReturnType<typeof vi.fn>;
let enhance: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let generate: ReturnType<typeof vi.fn>;

function aReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
    return {
        position: 1,
        text: 'A question',
        difficulty: 'beginner',
        options: [],
        selectedAnswerId: null,
        correctAnswerId: 1,
        isCorrect: false,
        topicTitle: 'Indexes',
        studyAdvice: 'Read about B-trees.',
        ...overrides,
    };
}

function aSubject(overrides: Partial<FeedbackSubject> = {}): FeedbackSubject {
    return {
        assessmentId: RUN_ID,
        score: 40,
        storedFeedback: null,
        review: [aReviewItem()],
        firstName: 'Ana',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_ENABLED;

    feedback = vi.fn(async () => 'Ana — you missed Indexes. Start there.');
    enhance = vi.fn(async () => ({
        items: [{ topicTitle: 'Indexes', aiDescription: 'Why indexes matter for you.' }],
    }));

    draft = vi.fn(async () => ({
        items: [
            {
                topicTitle: 'Filtering',
                difficulty: 'beginner' as const,
                description: 'What filtering buys you.',
            },
        ],
    }));

    generate = vi.fn(async () => [
        {
            question: 'What does an index cost on write?',
            options: ['Extra work per insert', 'Nothing', 'Less disk', 'A lock'],
            correctAnswer: 'Extra work per insert',
        },
    ]);

    vi.mocked(provider.getProvider).mockReturnValue({
        feedback,
        enhancePlan: enhance,
        draftPlan: draft,
        generateQuestions: generate,
    } as unknown as provider.AiProvider);

    vi.mocked(assessmentRepo.saveAiFeedback).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(planRepo.setAiDescriptions).mockImplementation(async (_c, _u, _a, items) => ({
        ok: true,
        value: items.length,
    }));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('feedbackFor — the persisted path', () => {
    it('returns the stored text without calling the provider', async () => {
        const text = await feedbackFor(
            nextMember(),
            aSubject({ storedFeedback: 'Generated last Tuesday.' }),
        );

        expect(text).toBe('Generated last Tuesday.');
        expect(feedback).not.toHaveBeenCalled();
        expect(assessmentRepo.saveAiFeedback).not.toHaveBeenCalled();
    });

    it('treats a blank stored value as nothing stored', async () => {
        await feedbackFor(nextMember(), aSubject({ storedFeedback: '   ' }));

        expect(feedback).toHaveBeenCalledTimes(1);
    });

    it('generates once and stores it against the calling member', async () => {
        const member = nextMember();

        const text = await feedbackFor(member, aSubject());

        expect(text).toBe('Ana — you missed Indexes. Start there.');
        expect(assessmentRepo.saveAiFeedback).toHaveBeenCalledWith(
            FAKE_CLIENT,
            member,
            RUN_ID,
            'Ana — you missed Indexes. Start there.',
        );
    });

    it('renders the same text on the next view, from the column and not the model', async () => {
        const member = nextMember();

        const first = await feedbackFor(member, aSubject());

        // What the second render sees: the same page read, with the column now
        // holding what the first render wrote.
        const second = await feedbackFor(member, aSubject({ storedFeedback: first }));

        expect(second).toBe(first);
        expect(feedback).toHaveBeenCalledTimes(1);
    });
});

describe('feedbackFor — degradation', () => {
    const fallbackFor = (score: number, areas: string[]) => buildFallbackFeedback({ score }, areas);

    it('falls back when the provider throws, and lets nothing escape', async () => {
        feedback.mockRejectedValue(new Error('upstream is down'));

        const text = await feedbackFor(nextMember(), aSubject({ score: 40 }));

        expect(text).toBe(fallbackFor(40, ['Indexes']));
        expect(assessmentRepo.saveAiFeedback).not.toHaveBeenCalled();
    });

    it('abandons a provider that hangs, at the deadline', async () => {
        vi.useFakeTimers();
        feedback.mockReturnValue(new Promise(() => {}));

        const pending = feedbackFor(nextMember(), aSubject({ score: 40 }));
        await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);

        expect(await pending).toBe(fallbackFor(40, ['Indexes']));
    });

    it('falls back when the provider returns an empty string', async () => {
        feedback.mockResolvedValue('   ');

        const text = await feedbackFor(nextMember(), aSubject({ score: 40 }));

        expect(text).toBe(fallbackFor(40, ['Indexes']));
        expect(assessmentRepo.saveAiFeedback).not.toHaveBeenCalled();
    });

    it('still returns the generated text when storing it fails', async () => {
        vi.mocked(assessmentRepo.saveAiFeedback).mockResolvedValue({
            ok: false,
            error: aRepoFailure(),
        });

        const text = await feedbackFor(nextMember(), aSubject());

        // Costs a regeneration next time. Better than showing nothing.
        expect(text).toBe('Ana — you missed Indexes. Start there.');
    });

    it('degrades rather than throwing when a member exhausts the rate limit', async () => {
        const member = nextMember();
        const subject = aSubject({ score: 40 });

        // The window allows ten; the eleventh must not become a 500.
        for (let call = 0; call < 10; call++) {
            await feedbackFor(member, subject);
        }

        expect(await feedbackFor(member, subject)).toBe(fallbackFor(40, ['Indexes']));
    });

    it('uses the difficulty bands when the run carries no topics', async () => {
        feedback.mockRejectedValue(new Error('upstream is down'));

        const text = await feedbackFor(
            nextMember(),
            aSubject({
                score: 30,
                review: [aReviewItem({ topicTitle: null, difficulty: 'beginner' })],
            }),
        );

        expect(text).toBe(fallbackFor(30, ['beginner-level questions']));
    });
});

describe('feedbackFor — AI switched off (SP-093 AC3)', () => {
    it('returns the rule-based text and calls nothing', async () => {
        process.env.AI_ENABLED = 'false';

        const text = await feedbackFor(nextMember(), aSubject({ score: 40 }));

        expect(text).toBe(buildFallbackFeedback({ score: 40 }, ['Indexes']));
        expect(feedback).not.toHaveBeenCalled();
    });

    it('does not store the fallback, so turning AI back on still generates', async () => {
        process.env.AI_ENABLED = 'off';

        await feedbackFor(nextMember(), aSubject());

        expect(assessmentRepo.saveAiFeedback).not.toHaveBeenCalled();
    });

    it('still prefers text that was generated before it was switched off', async () => {
        process.env.AI_ENABLED = 'false';

        const text = await feedbackFor(
            nextMember(),
            aSubject({ storedFeedback: 'Generated while the provider was up.' }),
        );

        expect(text).toBe('Generated while the provider was up.');
    });
});

describe('feedbackFor — what reaches the prompt (SP-094)', () => {
    it('passes a first name, a score and the weak areas, and nothing else', async () => {
        await feedbackFor(nextMember(), aSubject({ score: 40, firstName: 'Ana' }));

        expect(feedback).toHaveBeenCalledWith({
            firstName: 'Ana',
            score: 40,
            weakAreas: ['Indexes'],
        });
    });

    it('derives the weak areas from the paper rather than accepting them', async () => {
        await feedbackFor(
            nextMember(),
            aSubject({
                review: [
                    aReviewItem({ topicTitle: 'Sharding', difficulty: 'advanced' }),
                    aReviewItem({ topicTitle: 'Joins', isCorrect: true }),
                    aReviewItem({ topicTitle: 'Indexes', difficulty: 'beginner' }),
                ],
            }),
        );

        // Missed only, most fundamental first — a topic they got right is not
        // something to send a model, let alone something to study.
        expect(feedback.mock.calls[0][0].weakAreas).toEqual(['Indexes', 'Sharding']);
    });

    it('sends no name at all when there is not one', async () => {
        await feedbackFor(nextMember(), aSubject({ firstName: undefined }));

        expect(feedback.mock.calls[0][0].firstName).toBeUndefined();
    });

    it('reduces a full name to a first name', async () => {
        // The narrow shape of FeedbackContext keeps a caller from passing an
        // email or a user id; this keeps a caller from passing a whole name in
        // the one field that IS allowed. profiles.first_name is free text.
        await feedbackFor(nextMember(), aSubject({ firstName: 'Ana Maria Popescu' }));

        expect(feedback.mock.calls[0][0].firstName).toBe('Ana');
    });

    it('sends no name when the name is only whitespace', async () => {
        // `firstName: ''` is falsy but still a string, and would make the
        // prompt builder emit ", a student," with a blank in front of it.
        await feedbackFor(nextMember(), aSubject({ firstName: '   ' }));

        expect(feedback.mock.calls[0][0].firstName).toBeUndefined();
    });
});

describe('enhancePlan — SP-091', () => {
    const aTopic = (topicTitle: string) => ({
        topicTitle,
        ruleDescription: `You missed the beginner question on ${topicTitle}.`,
    });

    const aPlanSubject = (topics = [aTopic('Indexes')]) => ({
        assessmentId: RUN_ID,
        score: 40,
        topics,
        firstName: 'Ana',
    });

    it('writes the elaboration onto the rows the rules already produced', async () => {
        const member = nextMember();

        const written = await enhancePlan(member, aPlanSubject());

        expect(written).toBe(1);
        expect(planRepo.setAiDescriptions).toHaveBeenCalledWith(FAKE_CLIENT, member, RUN_ID, [
            { topicTitle: 'Indexes', aiDescription: 'Why indexes matter for you.' },
        ]);
    });

    it('shows the model the rule text, so it elaborates instead of repeating', async () => {
        await enhancePlan(nextMember(), aPlanSubject());

        expect(enhance).toHaveBeenCalledWith({
            firstName: 'Ana',
            score: 40,
            topics: [aTopic('Indexes')],
        });
    });

    it('drops a topic the rules never produced, rather than writing it', async () => {
        // The one failure that would corrupt a plan: a title the model
        // invented, or paraphrased, matching no row — or the wrong one.
        enhance.mockResolvedValue({
            items: [
                { topicTitle: 'Indexes', aiDescription: 'Kept.' },
                { topicTitle: 'Something the model made up', aiDescription: 'Dropped.' },
            ],
        });

        const written = await enhancePlan(nextMember(), aPlanSubject());

        expect(written).toBe(1);
        expect(vi.mocked(planRepo.setAiDescriptions).mock.calls[0][3]).toEqual([
            { topicTitle: 'Indexes', aiDescription: 'Kept.' },
        ]);
    });

    it('calls nothing when the rules produced no plan at all', async () => {
        expect(await enhancePlan(nextMember(), aPlanSubject([]))).toBe(0);
        expect(enhance).not.toHaveBeenCalled();
        expect(planRepo.setAiDescriptions).not.toHaveBeenCalled();
    });

    it('calls nothing when AI is switched off', async () => {
        process.env.AI_ENABLED = 'false';

        expect(await enhancePlan(nextMember(), aPlanSubject())).toBe(0);
        expect(enhance).not.toHaveBeenCalled();
    });

    it('leaves the plan alone when the provider throws', async () => {
        enhance.mockRejectedValue(new Error('upstream is down'));

        expect(await enhancePlan(nextMember(), aPlanSubject())).toBe(0);
        expect(planRepo.setAiDescriptions).not.toHaveBeenCalled();
    });

    it('abandons a provider that hangs, at the deadline', async () => {
        vi.useFakeTimers();
        enhance.mockReturnValue(new Promise(() => {}));

        const pending = enhancePlan(nextMember(), aPlanSubject());
        await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);

        expect(await pending).toBe(0);
        expect(planRepo.setAiDescriptions).not.toHaveBeenCalled();
    });

    it('reports nothing written when the store fails', async () => {
        vi.mocked(planRepo.setAiDescriptions).mockResolvedValue({
            ok: false,
            error: aRepoFailure(),
        });

        // The rule-based rows are already there and already render. A failed
        // decoration is a log line, not a member-visible problem.
        expect(await enhancePlan(nextMember(), aPlanSubject())).toBe(0);
    });

    it('degrades rather than throwing when a member exhausts the rate limit', async () => {
        const member = nextMember();

        for (let call = 0; call < 10; call++) {
            await enhancePlan(member, aPlanSubject());
        }

        expect(await enhancePlan(member, aPlanSubject())).toBe(0);
    });

    it('drops a repeated topic instead of writing the row twice', async () => {
        // enhancedPlanSchema permits a repeated topicTitle — rejecting the
        // whole plan over one repeat would break "degrade, never block", so the
        // de-duplication is this service's job. Two updates against one row
        // would also make the returned count claim more decorated rows than
        // the plan has.
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        enhance.mockResolvedValue({
            items: [
                { topicTitle: 'Indexes', aiDescription: 'First.' },
                { topicTitle: 'Indexes', aiDescription: 'Second.' },
            ],
        });

        const written = await enhancePlan(nextMember(), aPlanSubject());

        expect(written).toBe(1);
        expect(vi.mocked(planRepo.setAiDescriptions).mock.calls[0][3]).toEqual([
            // First one wins: the two descriptions are equally arbitrary, and
            // dropping both would punish the row for the model's mistake.
            { topicTitle: 'Indexes', aiDescription: 'First.' },
        ]);
    });

    it('reduces a full name to a first name before it reaches the prompt (SP-094)', async () => {
        // profiles.first_name is free text somebody can type a whole name into,
        // and grading.service now reads it straight from the row. firstNameOnly
        // is what stops a surname reaching text we store and render.
        await enhancePlan(nextMember(), {
            ...aPlanSubject(),
            firstName: 'Ana Maria Popescu',
        });

        expect(enhance.mock.calls[0][0].firstName).toBe('Ana');
    });
});

describe('draftPlan — a plan out of the questions alone', () => {
    const aDraftSubject = (overrides: Partial<PlanDraftSubject> = {}): PlanDraftSubject => ({
        score: 40,
        runLabel: 'SQL assessment',
        firstName: 'Ana',
        missed: [{ text: 'Which clause filters rows?', difficulty: 'beginner' }],
        ...overrides,
    });

    it('returns rows the plan table will take, with the model’s text as the AI half', async () => {
        const items = await draftPlan(nextMember(), aDraftSubject());

        expect(items).toEqual([
            {
                topicTitle: 'Filtering',
                // Deterministic, and the only sentence on the row that is not
                // the model's — so a drafted item renders like an enhanced one.
                description:
                    'This came out of the beginner questions you missed in your SQL assessment.',
                aiDescription: 'What filtering buys you.',
                // beginner, through the same table every rule-built row uses.
                priority: 1,
            },
        ]);
    });

    it('shows the model the questions, and never a topic — there is none to show', async () => {
        await draftPlan(nextMember(), aDraftSubject());

        expect(draft).toHaveBeenCalledWith({
            firstName: 'Ana',
            score: 40,
            runLabel: 'SQL assessment',
            missed: [{ text: 'Which clause filters rows?', difficulty: 'beginner' }],
        });
    });

    it('orders by urgency, so a beginner gap outranks an advanced one', async () => {
        draft.mockResolvedValue({
            items: [
                { topicTitle: 'Window functions', difficulty: 'advanced', description: 'Late.' },
                { topicTitle: 'Filtering', difficulty: 'beginner', description: 'First.' },
            ],
        });

        const items = await draftPlan(nextMember(), aDraftSubject());

        expect(items.map((item) => item.topicTitle)).toEqual(['Filtering', 'Window functions']);
        expect(items.map((item) => item.priority)).toEqual([1, 3]);
    });

    it('collapses a repeated topic, keeping the most urgent', async () => {
        // recommendation_plans_topic_unique makes this a FAILED INSERT rather
        // than a cosmetic repeat — the whole plan would be lost, in a caller
        // that logs and swallows.
        draft.mockResolvedValue({
            items: [
                { topicTitle: 'Joins', difficulty: 'advanced', description: 'The advanced one.' },
                { topicTitle: 'Joins', difficulty: 'beginner', description: 'The beginner one.' },
            ],
        });

        const items = await draftPlan(nextMember(), aDraftSubject());

        expect(items).toHaveLength(1);
        expect(items[0].priority).toBe(1);
        expect(items[0].aiDescription).toBe('The beginner one.');
    });

    it('keeps the most urgent MAX_DRAFTED_TOPICS rather than rejecting the plan', async () => {
        // The prompt asks for at most eight and the schema deliberately does
        // not enforce it: nine topics must cost the member one item, not all of
        // them.
        draft.mockResolvedValue({
            items: Array.from({ length: 9 }, (_, index) => ({
                topicTitle: `Topic ${index}`,
                difficulty: index === 8 ? ('advanced' as const) : ('beginner' as const),
                description: `About topic ${index}.`,
            })),
        });

        const items = await draftPlan(nextMember(), aDraftSubject());

        expect(items).toHaveLength(MAX_DRAFTED_TOPICS);
        expect(items.map((item) => item.topicTitle)).not.toContain('Topic 8');
    });

    it('reduces a full name to a first name before it reaches the prompt (SP-094)', async () => {
        await draftPlan(nextMember(), aDraftSubject({ firstName: 'Ana Maria Popescu' }));

        expect(draft.mock.calls[0][0].firstName).toBe('Ana');
    });

    it('asks for nothing when the member missed nothing', async () => {
        const items = await draftPlan(nextMember(), aDraftSubject({ missed: [] }));

        expect(items).toEqual([]);
        expect(draft).not.toHaveBeenCalled();
    });

    it('returns nothing, and calls nothing, when AI is switched off', async () => {
        process.env.AI_ENABLED = 'false';

        const items = await draftPlan(nextMember(), aDraftSubject());

        expect(items).toEqual([]);
        expect(draft).not.toHaveBeenCalled();
    });

    it('degrades to no plan when the provider throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        draft.mockRejectedValue(new Error('provider is down'));

        await expect(draftPlan(nextMember(), aDraftSubject())).resolves.toEqual([]);
    });

    it('abandons a provider that hangs, at the deadline', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.useFakeTimers();
        draft.mockImplementation(() => new Promise(() => {}));

        const pending = draftPlan(nextMember(), aDraftSubject());
        await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);

        await expect(pending).resolves.toEqual([]);
    });

    it('degrades rather than throwing when the member is rate limited', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const member = nextMember();

        // The window is ten; the eleventh is the one that must not throw.
        for (let attempt = 0; attempt < 11; attempt++) {
            await draftPlan(member, aDraftSubject());
        }

        expect(draft).toHaveBeenCalledTimes(10);
    });
});

describe('draftQuestions — SP-092', () => {
    const aSpec = {
        categoryId: 3,
        categoryName: 'Databases',
        difficulty: 'beginner' as const,
        count: 1,
    };

    it('hands back the same shape the admin create form produces', async () => {
        const result = await draftQuestions(nextMember(), aSpec);

        expect(result).toEqual({
            ok: true,
            value: [
                {
                    categoryId: 3,
                    text: 'What does an index cost on write?',
                    difficulty: 'beginner',
                    // This stub returns no topic, and null is the right answer
                    // for that: a question the bank accepts, that simply never
                    // becomes a plan row. The pair has its own tests below.
                    topicTitle: null,
                    studyAdvice: null,
                    answers: [
                        { text: 'Extra work per insert', isCorrect: true },
                        { text: 'Nothing', isCorrect: false },
                        { text: 'Less disk', isCorrect: false },
                        { text: 'A lock', isCorrect: false },
                    ],
                },
            ],
        });
    });

    it('carries a topic and its advice through to the bank (SP-060)', async () => {
        generate.mockResolvedValue([
            {
                question: 'What does an index cost on write?',
                options: ['Extra work per insert', 'Nothing'],
                correctAnswer: 'Extra work per insert',
                topicTitle: 'Indexes',
                studyAdvice: 'Reread how a B-tree is maintained on insert.',
            },
        ]);

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value[0].topicTitle).toBe('Indexes');
        expect(result.value[0].studyAdvice).toBe('Reread how a B-tree is maintained on insert.');
    });

    it('drops half a pair rather than the question it came with', async () => {
        // questionSchema refuses a topic with no advice — it is a plan row that
        // could never be written. The question itself is fine, though, and
        // losing it over a missing sentence is the worse trade.
        generate.mockResolvedValue([
            {
                question: 'What does an index cost on write?',
                options: ['Extra work per insert', 'Nothing'],
                correctAnswer: 'Extra work per insert',
                topicTitle: 'Indexes',
            },
        ]);

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value).toHaveLength(1);
        expect(result.value[0].topicTitle).toBeNull();
        expect(result.value[0].studyAdvice).toBeNull();
    });

    it('asks the provider for the category name, difficulty and count', async () => {
        await draftQuestions(nextMember(), aSpec);

        expect(generate).toHaveBeenCalledWith({
            categoryName: 'Databases',
            difficulty: 'beginner',
            count: 1,
        });
    });

    it('drops one unusable draft and keeps the rest', async () => {
        // Two identical options make a question unanswerable rather than hard.
        // The admin form refuses it; the model gets no exemption.
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        generate.mockResolvedValue([
            {
                question: 'A duplicate-option question?',
                options: ['Same', 'Same', 'Other'],
                correctAnswer: 'Other',
            },
            {
                question: 'A perfectly good question?',
                options: ['Right', 'Wrong'],
                correctAnswer: 'Right',
            },
        ]);

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(true);
        expect(result.ok && result.value).toHaveLength(1);
        expect(result.ok && result.value[0].text).toBe('A perfectly good question?');
    });

    it('reports a failure rather than an empty success when nothing is usable', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // The correct answer is not one of the options — draftQuestionsSchema
        // rejects the generation outright (AC4).
        generate.mockResolvedValue([
            {
                question: 'A question whose key is not an option?',
                options: ['A', 'B'],
                correctAnswer: 'Z',
            },
        ]);

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.message).toBe('Generation failed — try again.');
    });

    it('says so, rather than degrading silently, when the provider throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        generate.mockRejectedValue(new Error('upstream is down'));

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok === false && result.error.message).toBe('Generation failed — try again.');
    });

    it('abandons a provider that hangs, at the deadline', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.useFakeTimers();
        generate.mockReturnValue(new Promise(() => {}));

        const pending = draftQuestions(nextMember(), aSpec);
        await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);

        expect((await pending).ok).toBe(false);
    });

    it('explains itself when AI is switched off, and calls nothing', async () => {
        process.env.AI_ENABLED = 'false';

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error.message).toContain('switched off');
        expect(generate).not.toHaveBeenCalled();
    });

    it('tells an exhausted admin to WAIT, rather than that generation failed', async () => {
        // The one failure here with a real, correct action attached. It used to
        // be collapsed into "Generation failed — try again.", which is the
        // exact wrong instruction: the admin retries at once, fails again, and
        // reads a working rate limiter as a broken model.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const member = nextMember();

        for (let call = 0; call < 10; call++) {
            await draftQuestions(member, aSpec);
        }

        const result = await draftQuestions(member, aSpec);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('conflict');
            expect(result.error.message).toMatch(/wait/i);
            expect(result.error.message).not.toMatch(/generation failed/i);
        }
    });

    it('still says "generation failed" for the failures nobody can act on', async () => {
        // The other half of the same change: a timeout, a refusal and a body
        // that will not parse must NOT have grown a "wait a moment" message.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        generate.mockRejectedValue(new Error('503 Service Unavailable'));

        const result = await draftQuestions(nextMember(), aSpec);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('unavailable');
            expect(result.error.message).toBe('Generation failed — try again.');
        }
    });
});
