/**
 * Tests for lib/services/plan.service.ts.
 *
 * Stories: SP-061, SP-062, SP-063, SP-065
 *
 * The whole reason setItemStatus is a service function and not a one-line
 * repository call is the ownership check in the middle of it. There is no RLS
 * on this table, so that check is the only thing stopping one member ticking
 * off another member's plan by guessing a recommendation id — and "not yours"
 * has to read as not_found, never as forbidden, because the difference tells a
 * stranger the row exists.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as planRepo from '../../../lib/repositories/plan.repo';
import { createPlanRepo, FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aPlanItem, MEMBER_ID } from '../../helpers/builders';
import { getPlan, setItemStatus } from '../../../lib/services/plan.service';

vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));

const SOMEONE_ELSE = MEMBER_ID + 1;

let fake: ReturnType<typeof createPlanRepo>;

/** Points the auto-mocked module at the stateful fake for this test. */
function useFake(seed: Parameters<typeof createPlanRepo>[0] = []) {
    fake = createPlanRepo(seed);

    vi.mocked(planRepo.listByUser).mockImplementation(fake.listByUser);
    vi.mocked(planRepo.findById).mockImplementation(fake.findById);
    vi.mocked(planRepo.setStatus).mockImplementation(fake.setStatus);
}

beforeEach(() => {
    vi.clearAllMocks();
    useFake();
});

describe('getPlan', () => {
    it('returns the calling member’s items', async () => {
        useFake([
            { userId: MEMBER_ID, item: aPlanItem({ recommendationId: 1, priority: 2 }) },
            { userId: MEMBER_ID, item: aPlanItem({ recommendationId: 2, priority: 1 }) },
            { userId: SOMEONE_ELSE, item: aPlanItem({ recommendationId: 3 }) },
        ]);

        const result = await getPlan(MEMBER_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((item) => item.recommendationId)).toEqual([2, 1]);
    });

    it('returns an empty plan rather than an error when there is nothing yet', async () => {
        const result = await getPlan(MEMBER_ID);

        expect(result).toEqual({ ok: true, value: [] });
    });

    it('propagates a repository failure instead of returning an empty plan', async () => {
        vi.mocked(planRepo.listByUser).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await getPlan(MEMBER_ID);

        expect(result.ok).toBe(false);
    });
});

describe('setItemStatus', () => {
    it('moves an item the member owns', async () => {
        useFake([{ userId: MEMBER_ID, item: aPlanItem({ recommendationId: 42 }) }]);

        const result = await setItemStatus(MEMBER_ID, 42, 'completed');

        expect(result.ok).toBe(true);
        expect(fake.rows[0].item.status).toBe('completed');
    });

    it('refuses an item belonging to someone else, and does not write', async () => {
        useFake([{ userId: SOMEONE_ELSE, item: aPlanItem({ recommendationId: 42 }) }]);

        const result = await setItemStatus(MEMBER_ID, 42, 'completed');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
        expect(planRepo.setStatus).not.toHaveBeenCalled();
        expect(fake.rows[0].item.status).toBe('not_started');
    });

    it('says not_found for another member’s item, never forbidden', async () => {
        // 'forbidden' would confirm the row exists. Someone probing ids must
        // not be able to tell an item that is not theirs from one that is not
        // there at all, so both answers have to be the same answer.
        useFake([{ userId: SOMEONE_ELSE, item: aPlanItem({ recommendationId: 42 }) }]);

        const owned = await setItemStatus(MEMBER_ID, 42, 'completed');
        const absent = await setItemStatus(MEMBER_ID, 999, 'completed');

        expect(owned.ok).toBe(false);
        expect(absent.ok).toBe(false);
        if (owned.ok || absent.ok) return;

        expect(owned.error).toEqual(absent.error);
    });

    it('refuses an item that does not exist', async () => {
        const result = await setItemStatus(MEMBER_ID, 999, 'completed');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });

    it('propagates a lookup failure rather than reporting the item missing', async () => {
        // A database that is down must not be reported to the member as "that
        // plan item is not yours" — the two need different answers.
        vi.mocked(planRepo.findById).mockResolvedValue({ ok: false, error: aRepoFailure() });

        const result = await setItemStatus(MEMBER_ID, 42, 'completed');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
        expect(planRepo.setStatus).not.toHaveBeenCalled();
    });

    it('passes the session user id to the write, not just to the lookup', async () => {
        // The repository scopes its UPDATE by user_id as a second guard. A
        // service that checked ownership and then wrote unscoped would pass
        // every other test in this file.
        useFake([{ userId: MEMBER_ID, item: aPlanItem({ recommendationId: 42 }) }]);

        await setItemStatus(MEMBER_ID, 42, 'in_progress');

        expect(planRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, 42, 'in_progress');
    });
});
