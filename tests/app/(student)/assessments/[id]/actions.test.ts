/**
 * Run actions — save one answer, submit the paper.
 *
 * Layer: ACTION. Stories: SP-043, SP-046, SP-115
 *
 * These two are called programmatically from the runner rather than through a
 * <form>, so they take plain arguments and return a small object. The
 * interesting one is `submitAssessmentAction`, which on success does not return
 * at all — it redirects, and redirect() throws by design.
 *
 * The case worth the file: a `conflict` from the service means the run IS
 * already submitted (the timer firing at the same moment as a click, or a
 * second tab). That is not an error to show the member — the right place is
 * still the results page. Getting it wrong shows "That assessment could not be
 * submitted" on a paper that was submitted correctly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAnswerAction, submitAssessmentAction } from '../../../../../app/(student)/assessments/[id]/actions';
import { assertAuth } from '../../../../../lib/auth/assertAuth';
import { saveAnswer } from '../../../../../lib/services/assessment.service';
import { submit } from '../../../../../lib/services/grading.service';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { aCurrentUser, MEMBER_ID } from '../../../../helpers/builders';
import { ok, err } from '../../../../../lib/result';
import { appError } from '../../../../../lib/errors';

vi.mock('../../../../../lib/auth/assertAuth');
vi.mock('../../../../../lib/services/assessment.service');
vi.mock('../../../../../lib/services/grading.service');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
    // Throws, the way the real one does — otherwise execution runs past the
    // redirect and the test asserts a path production never takes.
    redirect: vi.fn((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

/** Runs something expected to redirect and returns where to. */
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
    try {
        await run();
    } catch (error) {
        if (error instanceof Error && 'url' in error) return (error as { url: string }).url;
        throw error;
    }
    throw new Error('expected a redirect');
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockResolvedValue(aCurrentUser());
});

describe('saveAnswerAction', () => {
    it('saves against the session user', async () => {
        vi.mocked(saveAnswer).mockResolvedValue(ok(undefined));

        const result = await saveAnswerAction(10, 20, 30);

        expect(saveAnswer).toHaveBeenCalledWith(MEMBER_ID, 10, 20, 30);
        expect(result).toEqual({ ok: true });
    });

    it('rejects a non-numeric id without calling the service', async () => {
        const result = await saveAnswerAction(Number.NaN, 20, 30);

        expect(result).toEqual({ ok: false, message: 'That answer could not be saved.' });
        expect(saveAnswer).not.toHaveBeenCalled();
    });

    it('passes the service message through so the runner can show it', async () => {
        vi.mocked(saveAnswer).mockResolvedValue(err(appError('not_found', 'That run is not yours.')));

        expect(await saveAnswerAction(10, 20, 30)).toEqual({
            ok: false,
            message: 'That run is not yours.',
        });
    });
});

describe('submitAssessmentAction', () => {
    it('redirects to the results on success', async () => {
        vi.mocked(submit).mockResolvedValue(ok({ score: 60 }));

        expect(await redirectOf(() => submitAssessmentAction(10))).toBe('/assessments/10/results');
        expect(submit).toHaveBeenCalledWith(MEMBER_ID, 10);
    });

    it('revalidates everything the submission just changed, before redirecting', async () => {
        vi.mocked(submit).mockResolvedValue(ok({ score: 60 }));

        await redirectOf(() => submitAssessmentAction(10));

        // The assessments page no longer has this run to resume; the dashboard,
        // profile and plan all just gained a result.
        for (const path of ['/dashboard', '/profile', '/plan', '/assessments']) {
            expect(revalidatePath).toHaveBeenCalledWith(path);
        }
    });

    it('treats a CONFLICT as already-submitted and still goes to the results', async () => {
        // The timer firing as the member clicks Submit, or a second tab. Both
        // are ordinary, and both must land on the score rather than on an
        // error the member cannot act on.
        vi.mocked(submit).mockResolvedValue(err(appError('conflict', 'Already submitted.')));

        expect(await redirectOf(() => submitAssessmentAction(10))).toBe('/assessments/10/results');
    });

    it('returns a real failure instead of redirecting', async () => {
        vi.mocked(submit).mockResolvedValue(err(appError('unknown', 'Grading is unavailable.')));

        expect(await submitAssessmentAction(10)).toEqual({
            ok: false,
            message: 'Grading is unavailable.',
        });
        expect(redirect).not.toHaveBeenCalled();
    });

    it('does not revalidate when the submission failed', async () => {
        vi.mocked(submit).mockResolvedValue(err(appError('unknown', 'Grading is unavailable.')));

        await submitAssessmentAction(10);

        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('rejects a bad id before touching the service', async () => {
        expect(await submitAssessmentAction(-1)).toEqual({
            ok: false,
            message: 'That assessment could not be submitted.',
        });
        expect(submit).not.toHaveBeenCalled();
    });
});
