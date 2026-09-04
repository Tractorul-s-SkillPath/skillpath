/**
 * Tests for lib/services/admin-stats.service.ts.
 *
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * With no RLS underneath, the assertAdmin() at the top of each function is the
 * only thing standing between a signed-in student and every other member's
 * results. The layout guard is not a substitute: it stops a student navigating
 * to the page, not a request that never rendered one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import * as statsRepo from '../../../lib/repositories/stats.repo';
import { PAGE_SIZE, WEAK_CATEGORY_LIMIT } from '../../../lib/validation/filters.schema';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aPage, anAdmin } from '../../helpers/builders';
import {
    getOverview,
    getWeakCategoryRanking,
    listAllResults,
} from '../../../lib/services/admin-stats.service';

vi.mock('../../../lib/auth/assertAdmin');
vi.mock('../../../lib/repositories/stats.repo');
vi.mock('../../../lib/supabase/server', () => ({
    // The admin services query through createServiceClient — service role, because
    // RLS has no admin policy and every write here would be refused with 42501.
    // Mocked alongside createClient so a service that is moved between the two
    // fails on its assertions rather than on an undefined import.
    createClient: vi.fn(async () => FAKE_CLIENT),
    createServiceClient: vi.fn(() => FAKE_CLIENT),
}));

const REDIRECTED = new Error('NEXT_REDIRECT /dashboard');

const noFilters = { search: '', categoryId: undefined, sort: 'date_desc', page: 1 };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
    vi.mocked(statsRepo.overviewCounts).mockResolvedValue({
        ok: true,
        value: { totalUsers: 3, totalAssessments: 9, averageScore: 61 },
    });
    vi.mocked(statsRepo.weakCategoryRanking).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(statsRepo.resultsPaged).mockResolvedValue({ ok: true, value: aPage([]) });
});

describe('the admin guard', () => {
    it.each([
        ['getOverview', () => getOverview()],
        ['getWeakCategoryRanking', () => getWeakCategoryRanking()],
        ['listAllResults', () => listAllResults(noFilters as never)],
    ])('stops %s before it reads anybody else’s data', async (_name, call) => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(call()).rejects.toThrow(REDIRECTED);

        expect(statsRepo.overviewCounts).not.toHaveBeenCalled();
        expect(statsRepo.weakCategoryRanking).not.toHaveBeenCalled();
        expect(statsRepo.resultsPaged).not.toHaveBeenCalled();
    });
});

describe('getOverview', () => {
    it('returns the aggregate counts as the repository reports them', async () => {
        await expect(getOverview()).resolves.toEqual({
            ok: true,
            value: { totalUsers: 3, totalAssessments: 9, averageScore: 61 },
        });
    });

    it('propagates a failure rather than reporting zeroes', async () => {
        // Zeroes would render as a real dashboard showing an empty product.
        vi.mocked(statsRepo.overviewCounts).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(getOverview()).resolves.toMatchObject({ ok: false });
    });
});

describe('getWeakCategoryRanking', () => {
    it('asks for the documented number of categories', async () => {
        await getWeakCategoryRanking();

        expect(statsRepo.weakCategoryRanking).toHaveBeenCalledWith(
            FAKE_CLIENT,
            WEAK_CATEGORY_LIMIT,
        );
    });
});

describe('listAllResults', () => {
    it('fixes the page size here, not from the URL', async () => {
        await listAllResults({ ...noFilters, pageSize: 5000 } as never);

        expect(statsRepo.resultsPaged).toHaveBeenCalledWith(
            FAKE_CLIENT,
            expect.objectContaining({ pageSize: PAGE_SIZE }),
        );
    });

    it('passes the validated filters through', async () => {
        await listAllResults({ search: 'ion', categoryId: 3, sort: 'score_asc', page: 2 } as never);

        expect(statsRepo.resultsPaged).toHaveBeenCalledWith(FAKE_CLIENT, {
            search: 'ion',
            categoryId: 3,
            sort: 'score_asc',
            page: 2,
            pageSize: PAGE_SIZE,
        });
    });
});
