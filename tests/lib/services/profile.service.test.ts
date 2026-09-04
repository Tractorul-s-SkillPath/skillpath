/**
 * Tests for lib/services/profile.service.ts.
 *
 * Stories: SP-020, SP-021, SP-022, SP-070, SP-071, SP-072
 *
 * The dashboard read is the one place in the codebase where a partial failure
 * is the designed behaviour: only the member's own row is fatal, and every
 * other section degrades to its empty state rather than taking the page down.
 * That is easy to write and easy to lose in a refactor, so most of the tests
 * below are failure cases rather than happy paths.
 *
 * ON THE `cache()` WRAPPER: loadDashboard is wrapped in React's cache(), which
 * memoises per user id. Each dashboard test therefore uses its own id — sharing
 * one would mean the second test read the first test's result and passed
 * without calling a single repository.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as profileRepo from '../../../lib/repositories/profile.repo';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as planRepo from '../../../lib/repositories/plan.repo';
import * as xpRepo from '../../../lib/repositories/xp.repo';
import { APP_TIMEZONE, LEADERBOARD_SIZE } from '../../../lib/domain/constants';
import { FAKE_CLIENT, aRepoFailure } from '../../helpers/in-memory-repos';
import { aCategory, anAssessment, aPlanItem, MEMBER_ID } from '../../helpers/builders';
import {
    today,
    getProfileDashboard,
    getHeaderXp,
    updateName,
    setInterests,
    setCategoryLevel,
} from '../../../lib/services/profile.service';

vi.mock('../../../lib/repositories/profile.repo');
vi.mock('../../../lib/repositories/assessment.repo');
vi.mock('../../../lib/repositories/plan.repo');
vi.mock('../../../lib/repositories/xp.repo');
vi.mock('../../../lib/supabase/server', () => ({
    createClient: vi.fn(async () => FAKE_CLIENT),
}));

/**
 * A fresh id per dashboard test, to step around the cache() memoisation.
 *
 * A UUID rather than a counter now, because that is what `users.user_id` is.
 * The counter still drives it, so the ids stay readable and ordered in a
 * failure message instead of being sixteen random bytes.
 */
let nextUserId = 1000;
const anUnseenUser = () => `00000000-0000-4000-8000-${String((nextUserId += 1)).padStart(12, '0')}`;

const aProfile = {
    userId: MEMBER_ID,
    firstName: 'Ion',
    lastName: 'Popescu',
    email: 'member@test.com',
    role: 'student' as const,
    status: 'active',
    joinedAt: '2026-01-01T00:00:00.000Z',
};

function anInterest(overrides: Record<string, unknown> = {}) {
    return {
        categoryId: 3,
        name: 'Databases',
        level: 'intermediate',
        lastScore: 72,
        assessedAt: '2026-06-01T10:00:00.000Z',
        ...overrides,
    } as never;
}

beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(profileRepo.findByUserId).mockResolvedValue({ ok: true, value: aProfile });
    vi.mocked(profileRepo.listInterests).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(profileRepo.listActiveCategories).mockResolvedValue({
        ok: true,
        value: [aCategory()],
    });
    vi.mocked(profileRepo.updateName).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(profileRepo.syncInterests).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(profileRepo.setCategoryLevel).mockResolvedValue({ ok: true, value: undefined });
    vi.mocked(assessmentRepo.listByUser).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(planRepo.listByUser).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(xpRepo.totalFor).mockResolvedValue({ ok: true, value: 250 });
    vi.mocked(xpRepo.streakFor).mockResolvedValue({ ok: true, value: 3 });
    vi.mocked(xpRepo.awardBadges).mockResolvedValue({ ok: true, value: [] });
    vi.mocked(xpRepo.badgeAwardsFor).mockResolvedValue({ ok: true, value: {} });
    vi.mocked(xpRepo.leaderboard).mockResolvedValue({
        ok: true,
        value: { entries: [], myRank: null },
    });
});

describe('today', () => {
    it('formats as an ISO date, so it can be compared as a string', () => {
        expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('answers in the application timezone, not the server’s', () => {
        // A streak that rolls over at the server's midnight instead of the
        // member's is a streak that breaks for no visible reason.
        const expected = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(
            new Date(),
        );

        expect(today()).toBe(expected);
    });
});

describe('getHeaderXp', () => {
    it('returns the member’s XP total', async () => {
        await expect(getHeaderXp(MEMBER_ID)).resolves.toBe(250);
    });

    it('returns zero rather than throwing when the read fails', async () => {
        // This renders in the header of every page. A failure here must not
        // take down a page that has nothing to do with XP.
        vi.mocked(xpRepo.totalFor).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(getHeaderXp(MEMBER_ID)).resolves.toBe(0);
    });
});

describe('updateName', () => {
    it('maps to the column names the table actually has', async () => {
        await updateName(MEMBER_ID, 'Maria', 'Ionescu');

        expect(profileRepo.updateName).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, {
            first_name: 'Maria',
            last_name: 'Ionescu',
        });
    });

    it('propagates a write failure', async () => {
        vi.mocked(profileRepo.updateName).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(updateName(MEMBER_ID, 'Maria', 'Ionescu')).resolves.toMatchObject({
            ok: false,
        });
    });
});

describe('setInterests', () => {
    it('follows the categories the member chose', async () => {
        await setInterests(MEMBER_ID, [1, 2, 3]);

        expect(profileRepo.syncInterests).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, [1, 2, 3]);
    });

    it('removes duplicates before writing', async () => {
        // A repeated id would violate the unique constraint on the join table
        // and fail the whole save.
        await setInterests(MEMBER_ID, [1, 2, 2, 1, 3]);

        expect(profileRepo.syncInterests).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, [1, 2, 3]);
    });

    it('accepts an empty selection — following nothing is a valid state', async () => {
        await setInterests(MEMBER_ID, []);

        expect(profileRepo.syncInterests).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, []);
    });
});

describe('setCategoryLevel', () => {
    it('passes the level through to the repository', async () => {
        await setCategoryLevel(MEMBER_ID, 3, 'advanced');

        expect(profileRepo.setCategoryLevel).toHaveBeenCalledWith(
            FAKE_CLIENT,
            MEMBER_ID,
            3,
            'advanced',
        );
    });
});

describe('getProfileDashboard', () => {
    it('assembles the dashboard from every section', async () => {
        const userId = anUnseenUser();
        vi.mocked(profileRepo.listInterests).mockResolvedValue({ ok: true, value: [anInterest()] });
        vi.mocked(assessmentRepo.listByUser).mockResolvedValue({
            ok: true,
            value: [anAssessment()],
        });
        vi.mocked(planRepo.listByUser).mockResolvedValue({ ok: true, value: [aPlanItem()] });

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toMatchObject({
            profile: aProfile,
            xp: 250,
            streak: 3,
            overallLevel: 'intermediate',
        });
        expect(result.value.assessments).toHaveLength(1);
        expect(result.value.plan).toHaveLength(1);
    });

    it('fails only when the member’s own row cannot be read', async () => {
        const userId = anUnseenUser();
        vi.mocked(profileRepo.findByUserId).mockResolvedValue({ ok: false, error: aRepoFailure() });

        await expect(getProfileDashboard(userId)).resolves.toMatchObject({ ok: false });
    });

    it('degrades every other section to empty rather than failing the page', async () => {
        const userId = anUnseenUser();
        const failure = { ok: false as const, error: aRepoFailure() };

        vi.mocked(profileRepo.listInterests).mockResolvedValue(failure);
        vi.mocked(profileRepo.listActiveCategories).mockResolvedValue(failure);
        vi.mocked(assessmentRepo.listByUser).mockResolvedValue(failure);
        vi.mocked(planRepo.listByUser).mockResolvedValue(failure);
        vi.mocked(xpRepo.streakFor).mockResolvedValue(failure);
        vi.mocked(xpRepo.badgeAwardsFor).mockResolvedValue(failure);
        vi.mocked(xpRepo.leaderboard).mockResolvedValue(failure);

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toMatchObject({
            interests: [],
            catalog: [],
            assessments: [],
            plan: [],
            streak: 0,
            leaderboard: [],
            myRank: null,
            overallLevel: null,
        });
    });

    it('reads XP back after awarding badges, so a new badge shows in the total', async () => {
        // A badge award is itself XP. Reading the total before the write would
        // show a number that is short by exactly the badge the member just
        // earned, until the next page load.
        const userId = anUnseenUser();
        vi.mocked(xpRepo.totalFor)
            .mockResolvedValueOnce({ ok: true, value: 250 })
            .mockResolvedValueOnce({ ok: true, value: 275 });

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(xpRepo.awardBadges).toHaveBeenCalled();
        expect(result.value.xp).toBe(275);
    });

    it('falls back to the earlier XP total when the second read fails', async () => {
        const userId = anUnseenUser();
        vi.mocked(xpRepo.totalFor)
            .mockResolvedValueOnce({ ok: true, value: 250 })
            .mockResolvedValueOnce({ ok: false, error: aRepoFailure() });

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.xp).toBe(250);
    });

    it('takes the most recent assessment date as the last active day', async () => {
        const userId = anUnseenUser();
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [
                anInterest({ categoryId: 1, assessedAt: '2026-05-01T00:00:00.000Z' }),
                anInterest({ categoryId: 2, assessedAt: '2026-06-01T00:00:00.000Z' }),
                anInterest({ categoryId: 3, assessedAt: null }),
            ],
        });

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.lastActiveOn).toBe('2026-06-01T00:00:00.000Z');
    });

    it('reports no last active day for a member who has never been assessed', async () => {
        const userId = anUnseenUser();
        vi.mocked(profileRepo.listInterests).mockResolvedValue({
            ok: true,
            value: [anInterest({ assessedAt: null })],
        });

        const result = await getProfileDashboard(userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.lastActiveOn).toBeNull();
    });

    it('asks for the documented leaderboard size', async () => {
        const userId = anUnseenUser();

        await getProfileDashboard(userId);

        expect(xpRepo.leaderboard).toHaveBeenCalledWith(FAKE_CLIENT, userId, LEADERBOARD_SIZE);
    });
});
