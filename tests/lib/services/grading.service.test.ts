/**
 * Tests for lib/services/grading.service.ts.
 *
 * Stories: SP-046, SP-053, SP-055, SP-091, SP-115, SP-116, SP-117
 *
 * THE SCORE IS NOT COMPUTED HERE and these tests must not pretend otherwise.
 * submit() takes no score and could not write one if it did — grading is the
 * grade_assessment() RPC, which scores, snapshots is_correct, sets status and
 * awards XP in a single call. What this service adds afterwards is the baseline
 * plan, and the rule worth pinning is that a failure in that second half must
 * never turn a graded, paid-for run back into an error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as responseRepo from '../../../lib/repositories/response.repo';
import * as planRepo from '../../../lib/repositories/plan.repo';
import * as categoryRepo from '../../../lib/repositories/category.repo';
import * as profileRepo from '../../../lib/repositories/profile.repo';
import * as aiService from '../../../lib/services/ai.service';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../../lib/domain/constants';
import type { ReviewItem } from '../../../lib/domain/types';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aCategory, aPlanItem, MEMBER_ID } from '../../helpers/builders';
import { submit, getResults } from '../../../lib/services/grading.service';

vi.mock('../../../lib/repositories/assessment.repo');
vi.mock('../../../lib/repositories/response.repo');
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/repositories/category.repo');
// Read only to give the plan prompt a first name (SP-094). It is not on the
// critical path — a failure here costs a greeting, not a plan — which is why
// the tests below cover the unreadable case as well as the ordinary one.
vi.mock('../../../lib/repositories/profile.repo');
vi.mock('../../../lib/services/ai.service');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));

const CATEGORY_RUN = 3;
const RUN_ID = 500;

/** The raw row findOwn hands back — snake_case, straight from the table. */
function aRow(overrides: Record<string, unknown> = {}) {
    return {
        assessment_id: RUN_ID,
        category_id: GENERAL_KNOWLEDGE_CATEGORY_ID,
        status: 'in_progress',
        total_score: null,
        submitted_at: null,
        started_at: '2026-06-01T10:00:00.000Z',
        created_at: '2026-06-01T10:00:00.000Z',
        time_limit_seconds: 1500,
        ...overrides,
    } as never;
}

function aReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
    return {
        position: 1,
        text: 'A question',
        difficulty: 'beginner',
        options: [],
        selectedAnswerId: null,
        correctAnswerId: 1,
        isCorrect: true,
        topicTitle: 'Indexes',
        studyAdvice: 'Read up on B-trees.',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assessmentRepo.grade).mockResolvedValue({ ok: true, value: 72 });
    vi.mocked(responseRepo.listForReview).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(planRepo.insertMany).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(aiService.enhancePlan).mockResolvedValue(0);
    // The fallback, off by default: every test below that does not set this up
    // is about a bank the RULES can read, and drafting must not run for those.
    vi.mocked(aiService.draftPlan).mockResolvedValue([]);
    vi.mocked(profileRepo.findByUserId).mockResolvedValue({
        ok: true,
        value: {
            userId: MEMBER_ID,
            // A full name on purpose: the prompt must only ever see "Ana", and
            // firstNameOnly in lib/ai/guardrails is what makes that true.
            firstName: 'Ana',
            lastName: 'Popescu',
            email: 'ana.popescu@example.com',
            role: 'student',
            status: 'active',
            joinedAt: '2026-01-01T00:00:00Z',
        },
    });
    vi.mocked(planRepo.listByUser).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(categoryRepo.findById).mockResolvedValue({ ok: true, value: aCategory() });
});

describe('submit', () => {
    it('grades an in-progress run and returns the score the database produced', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });

        await expect(submit(MEMBER_ID, RUN_ID)).resolves.toEqual({
            ok: true,
            value: { score: 72 },
        });
        expect(assessmentRepo.grade).toHaveBeenCalledWith(FAKE_CLIENT, RUN_ID);
    });

    it('refuses a run that is not this member’s, without saying whether it exists', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: null });

        const result = await submit(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
        expect(assessmentRepo.grade).not.toHaveBeenCalled();
    });

    it('refuses a second submission as a conflict, and does not grade again', async () => {
        // Grading twice would award XP twice. The RPC refuses as well; this is
        // the check that keeps the member out of it in the first place.
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ status: 'submitted', total_score: 72 }),
        });

        const result = await submit(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
        expect(assessmentRepo.grade).not.toHaveBeenCalled();
    });

    it('propagates a failed lookup rather than reporting the run missing', async () => {
        // A database that is down must not tell a member their run does not
        // exist — especially here, where their next move is to submit again.
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await submit(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
        expect(assessmentRepo.grade).not.toHaveBeenCalled();
    });

    it('propagates a grading failure', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });
        vi.mocked(assessmentRepo.grade).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(submit(MEMBER_ID, RUN_ID)).resolves.toMatchObject({ ok: false });
    });

    describe('the baseline plan', () => {
        beforeEach(() => {
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });
        });

        it('writes plan items for the questions the member got wrong', async () => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [
                    aReviewItem({ position: 1, isCorrect: true }),
                    aReviewItem({ position: 2, isCorrect: false, topicTitle: 'Joins' }),
                ],
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(planRepo.insertMany).toHaveBeenCalledWith(
                FAKE_CLIENT,
                MEMBER_ID,
                GENERAL_KNOWLEDGE_CATEGORY_ID,
                RUN_ID,
                expect.arrayContaining([expect.anything()]),
            );
        });

        it('treats an unanswered question as a gap, the same as a wrong one', async () => {
            // is_correct is false for both after grading, and a skipped
            // question is as much a gap as a missed one.
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false, selectedAnswerId: null })],
            });

            await submit(MEMBER_ID, RUN_ID);

            const items = vi.mocked(planRepo.insertMany).mock.calls[0]?.[4];
            expect(items?.length).toBeGreaterThan(0);
        });

        it('writes nothing when every answer was correct', async () => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: true })],
            });

            await submit(MEMBER_ID, RUN_ID);

            const items = vi.mocked(planRepo.insertMany).mock.calls[0]?.[4];
            expect(items).toEqual([]);
        });

        it('is built for a category run too, against that category (SP-060)', async () => {
            // The inverse of this test used to live here: "only the baseline
            // generates a plan". That was never a rule, it was the shape of a
            // gap — category questions had no topic to recommend — and the
            // admin form collects one now.
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
                ok: true,
                value: aRow({ category_id: CATEGORY_RUN }),
            });
            vi.mocked(categoryRepo.findById).mockResolvedValue({
                ok: true,
                value: aCategory({ name: 'Databases' }),
            });
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false })],
            });

            await submit(MEMBER_ID, RUN_ID);

            const [, , categoryId, , items] = vi.mocked(planRepo.insertMany).mock.calls[0]!;
            expect(categoryId).toBe(CATEGORY_RUN);
            expect(items).toHaveLength(1);
            expect(items[0].description).toContain('your Databases assessment');
        });

        it('names the run honestly when the category cannot be read', async () => {
            // A failed lookup costs a phrase, never the plan. "your last
            // assessment" is true; a category name invented here would not be.
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
                ok: true,
                value: aRow({ category_id: CATEGORY_RUN }),
            });
            vi.mocked(categoryRepo.findById).mockResolvedValue({
                ok: false,
                error: aRepoFailure(),
            });
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false })],
            });

            await submit(MEMBER_ID, RUN_ID);

            const items = vi.mocked(planRepo.insertMany).mock.calls[0]?.[4];
            expect(items?.[0].description).toContain('your last assessment');
        });

        it('does not read the category name for the baseline, which names itself', async () => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false })],
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(categoryRepo.findById).not.toHaveBeenCalled();
            const items = vi.mocked(planRepo.insertMany).mock.calls[0]?.[4];
            expect(items?.[0].description).toContain('your baseline assessment');
        });

        it('still returns the score when the plan cannot be written', async () => {
            // The run is graded and paid for by this point. Turning that into
            // an error would show a member who scored 72 an error page and no
            // way to see it.
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false })],
            });
            vi.mocked(planRepo.insertMany).mockResolvedValue({ ok: false, error: aRepoFailure() });
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(submit(MEMBER_ID, RUN_ID)).resolves.toEqual({
                ok: true,
                value: { score: 72 },
            });
        });

        it('still returns the score when the review cannot be read', async () => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: false,
                error: aRepoFailure(),
            });

            await expect(submit(MEMBER_ID, RUN_ID)).resolves.toEqual({
                ok: true,
                value: { score: 72 },
            });
            expect(planRepo.insertMany).not.toHaveBeenCalled();
        });
    });

    describe('the AI elaboration on top of it (SP-091)', () => {
        beforeEach(() => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false, topicTitle: 'Indexes' })],
            });
        });

        it('is offered the rows the rules just produced, with their rule text', async () => {
            await submit(MEMBER_ID, RUN_ID);

            // Same titles and same text as insertMany got — that is what makes
            // the model elaborate on the plan rather than write a second one.
            const inserted = vi.mocked(planRepo.insertMany).mock.calls[0]?.[4] ?? [];

            expect(aiService.enhancePlan).toHaveBeenCalledWith(MEMBER_ID, {
                assessmentId: RUN_ID,
                score: 72,
                firstName: 'Ana',
                topics: inserted.map((item) => ({
                    topicTitle: item.topicTitle,
                    ruleDescription: item.description,
                })),
            });
        });

        it('gives the plan prompt a first name (SP-091, SP-094)', async () => {
            // This used to be structurally impossible. submit() is called with
            // a user id and nothing else, so `PlanSubject.firstName` was never
            // populated by the only caller there is: the feedback prompt got a
            // name because its page already had the profile, and the plan
            // prompt was permanently nameless.
            await submit(MEMBER_ID, RUN_ID);

            expect(profileRepo.findByUserId).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID);
            expect(vi.mocked(aiService.enhancePlan).mock.calls[0][1].firstName).toBe('Ana');
        });

        it('costs a greeting, not a plan, when the profile cannot be read', async () => {
            vi.mocked(profileRepo.findByUserId).mockResolvedValue({
                ok: false,
                error: aRepoFailure(),
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.enhancePlan).toHaveBeenCalled();
            expect(vi.mocked(aiService.enhancePlan).mock.calls[0][1].firstName).toBeUndefined();
        });

        it('does not read a profile when there is no plan to decorate', async () => {
            // The lookup sits INSIDE the branch that has rows, so a run with
            // nothing to recommend does not pay for a query whose only use is a
            // prompt that is never built. This used to be demonstrated with a
            // category run, back when a category run could not produce a plan
            // at all; a full-marks paper is the honest way to say it now.
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: true })],
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(profileRepo.findByUserId).not.toHaveBeenCalled();
            expect(aiService.enhancePlan).not.toHaveBeenCalled();
        });

        it('is not attempted when the rule-based rows were not written', async () => {
            // Nothing to decorate, and a model call for rows that do not exist
            // is money spent on an update that matches nothing.
            vi.mocked(planRepo.insertMany).mockResolvedValue({ ok: false, error: aRepoFailure() });
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.enhancePlan).not.toHaveBeenCalled();
        });

        it('cannot turn a graded run into an error', async () => {
            // enhancePlan is documented never to throw. If that ever changes,
            // this is the test that says what it would cost.
            vi.mocked(aiService.enhancePlan).mockRejectedValue(new Error('boom'));
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(submit(MEMBER_ID, RUN_ID)).resolves.toEqual({
                ok: true,
                value: { score: 72 },
            });
        });
    });

    describe('the drafted plan, when the rules have nothing to say', () => {
        /** A bank written before topic_title existed: a real question, no annotation. */
        const anUnannotatedMiss = (overrides: Partial<ReviewItem> = {}) =>
            aReviewItem({
                isCorrect: false,
                text: 'Which clause filters rows before grouping?',
                topicTitle: null,
                studyAdvice: null,
                ...overrides,
            });

        const aDraftedRow = {
            topicTitle: 'Filtering',
            description: 'This came out of the beginner questions you missed in your run.',
            aiDescription: 'Why filtering is the thing to fix first.',
            priority: 1,
        };

        beforeEach(() => {
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
                ok: true,
                value: aRow({ category_id: CATEGORY_RUN }),
            });
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [anUnannotatedMiss()],
            });
            vi.mocked(aiService.draftPlan).mockResolvedValue([aDraftedRow]);
        });

        it('is shown the questions themselves, and the phrase naming the run', async () => {
            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.draftPlan).toHaveBeenCalledWith(MEMBER_ID, {
                score: 72,
                // From the category, not from the form — aCategory()'s name.
                runLabel: `${aCategory().name} assessment`,
                firstName: 'Ana',
                missed: [
                    { text: 'Which clause filters rows before grouping?', difficulty: 'beginner' },
                ],
            });
        });

        it('writes what it drafted, through the same statement a rule plan uses', async () => {
            await submit(MEMBER_ID, RUN_ID);

            expect(planRepo.insertMany).toHaveBeenCalledWith(
                FAKE_CLIENT,
                MEMBER_ID,
                CATEGORY_RUN,
                RUN_ID,
                [aDraftedRow],
            );
        });

        it('does not then send the drafted rows back for enhancement', async () => {
            // They already carry the model's paragraph. A second call would
            // spend money asking a model to elaborate its own prose, and
            // overwrite a good paragraph with a worse one.
            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.enhancePlan).not.toHaveBeenCalled();
        });

        it('names the baseline as the baseline', async () => {
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });

            await submit(MEMBER_ID, RUN_ID);

            expect(vi.mocked(aiService.draftPlan).mock.calls[0][1].runLabel).toBe(
                'baseline assessment',
            );
        });

        it('is not asked when the rules produced rows of their own', async () => {
            // Rules first, always: deterministic, free, and written by somebody
            // who knows the material. The model only fills a silence.
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: false, topicTitle: 'Indexes' })],
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.draftPlan).not.toHaveBeenCalled();
            expect(aiService.enhancePlan).toHaveBeenCalled();
        });

        it('is not asked when the member missed nothing at all', async () => {
            vi.mocked(responseRepo.listForReview).mockResolvedValue({
                ok: true,
                value: [aReviewItem({ isCorrect: true })],
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(aiService.draftPlan).not.toHaveBeenCalled();
            expect(profileRepo.findByUserId).not.toHaveBeenCalled();
        });

        it('leaves the score alone when drafting produces nothing', async () => {
            // Provider off, down, or rate limited. The member is exactly where
            // they were before this feature existed: graded, paid, no plan.
            vi.mocked(aiService.draftPlan).mockResolvedValue([]);

            await expect(submit(MEMBER_ID, RUN_ID)).resolves.toEqual({
                ok: true,
                value: { score: 72 },
            });
            expect(vi.mocked(planRepo.insertMany).mock.calls[0]?.[4]).toEqual([]);
        });
    });
});

describe('getResults', () => {
    const submittedRow = aRow({
        status: 'submitted',
        total_score: 84,
        submitted_at: '2026-06-01T10:20:00.000Z',
    });

    beforeEach(() => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: submittedRow });
        vi.mocked(responseRepo.listForReview).mockResolvedValue({
            ok: true,
            value: [aReviewItem()],
        });
    });

    it('returns the score and the level it implies', async () => {
        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.score).toBe(84);
        expect(result.value.level).toBe('advanced');
        expect(result.value.submittedAt).toBe('2026-06-01T10:20:00.000Z');
    });

    it('refuses a run that is not this member’s', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: null });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });

    it('propagates a failed lookup rather than reporting the run missing', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
    });

    it('reports an unsubmitted run as a conflict, so the page can bounce into the run', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({ ok: true, value: aRow() });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
    });

    it('propagates a failed review read — there is no results page without it', async () => {
        vi.mocked(responseRepo.listForReview).mockResolvedValue({
            ok: false,
            error: aRepoFailure(),
        });

        await expect(getResults(MEMBER_ID, RUN_ID)).resolves.toMatchObject({ ok: false });
    });

    it('degrades the headline rather than the page when the category cannot be read', async () => {
        vi.mocked(categoryRepo.findById).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.categoryName).toBe('Assessment');
    });

    it('shows only the plan items belonging to this run’s category', async () => {
        vi.mocked(planRepo.listByUser).mockResolvedValue({
            ok: true,
            value: [
                aPlanItem({ recommendationId: 1, categoryId: GENERAL_KNOWLEDGE_CATEGORY_ID }),
                aPlanItem({ recommendationId: 2, categoryId: CATEGORY_RUN }),
            ],
        });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.recommendations.map((item) => item.recommendationId)).toEqual([1]);
    });

    it('shows no recommendations rather than failing when the plan cannot be read', async () => {
        vi.mocked(planRepo.listByUser).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.recommendations).toEqual([]);
    });

    it('treats a missing total_score as zero rather than NaN', async () => {
        vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
            ok: true,
            value: aRow({ status: 'submitted', total_score: null }),
        });

        const result = await getResults(MEMBER_ID, RUN_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.score).toBe(0);
        expect(result.value.level).toBe('beginner');
    });
});
