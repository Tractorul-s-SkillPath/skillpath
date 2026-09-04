/**
 * Tests for lib/services/grading.service.ts.
 *
 * Stories: SP-046, SP-053, SP-055, SP-115, SP-116, SP-117
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
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../../lib/domain/constants';
import type { ReviewItem } from '../../../lib/domain/types';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aCategory, aPlanItem, MEMBER_ID } from '../../helpers/builders';
import { submit, getResults } from '../../../lib/services/grading.service';

vi.mock('../../../lib/repositories/assessment.repo');
vi.mock('../../../lib/repositories/response.repo');
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/repositories/category.repo');
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

        it('is not built for a category run — only the baseline generates a plan', async () => {
            vi.mocked(assessmentRepo.findOwn).mockResolvedValue({
                ok: true,
                value: aRow({ category_id: CATEGORY_RUN }),
            });

            await submit(MEMBER_ID, RUN_ID);

            expect(responseRepo.listForReview).not.toHaveBeenCalled();
            expect(planRepo.insertMany).not.toHaveBeenCalled();
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
