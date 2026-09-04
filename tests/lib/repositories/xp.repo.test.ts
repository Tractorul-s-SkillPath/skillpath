/**
 * xp.repo — against the real test database.
 *
 * Stories: SP-101 … SP-105
 *
 * The ledger is append-only and most of it is written by triggers, so almost
 * nothing here can be observed without a database. Three things in particular:
 *
 *  - `awardBadges` is a read-then-insert and the comment above it explains why
 *    at length: `xp_events_badge_once` is a PARTIAL unique index, Postgres will
 *    not use one for ON CONFLICT unless the statement repeats the predicate,
 *    and PostgREST has nowhere to put a WHERE. The upsert it used to be failed
 *    with 42P10 on EVERY render of the profile page. Only a real index can fail
 *    that way, so only this file can stop it coming back.
 *  - idempotence is by index, not by care. Calling it twice must insert once.
 *  - `current_streak` and the `user_xp_totals` / `leaderboard` views are SQL.
 *    A fake over them asserts the mapper and nothing else.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as xpRepo from '../../../lib/repositories/xp.repo';
import { XP_PER_BADGE } from '../../../lib/domain/constants';
import { deriveBadges } from '../../../lib/domain/derived';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

// Real codes, taken from the rules that award them rather than invented here.
// `xp_events_code_check` rejects a made-up short code, so an invented one fails
// on the fixture instead of on the behaviour under test — and tests/README.md
// rules out inlining a business constant regardless. BADGE_RULES itself is not
// exported; deriveBadges over an empty input is the public way to ask for the
// full catalogue, earned flags and all.
const ALL_BADGE_CODES = deriveBadges({
    assessments: [],
    plan: [],
    levels: [],
    today: '2026-01-01',
}).map((badge) => badge.code);
const [BADGE_A, BADGE_B, BADGE_C] = ALL_BADGE_CODES;
const STREAK_BADGE = ALL_BADGE_CODES[ALL_BADGE_CODES.length - 1];

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'xp-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

/** A member who has submitted one paper, so the trigger has paid them once. */
async function aMemberWhoSatAPaper() {
    const member = await sandbox.createUser();
    const category = await sandbox.createCategoryWithBank(2);

    const created = await assessmentRepo.createWithResponses(db, {
        userId: member.userId,
        categoryId: category.categoryId,
        requestedLevel: 'beginner',
        timeLimitSeconds: 600,
        questionIds: category.questions.map((q) => q.questionId),
    });

    if (!created.ok) throw new Error(`could not open a run: ${created.error.message}`);
    await assessmentRepo.grade(db, created.value);

    return { member, category, assessmentId: created.value };
}

describe('totalFor', () => {
    it('is 0 for a member who has done nothing, not an error', async () => {
        // `maybeSingle()` plus `?? 0`: a member with no ledger rows has no row
        // in the view at all, and a new member's profile page must render.
        const member = await sandbox.createUser();

        const result = await xpRepo.totalFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(0);
    });

    it('sums the ledger after a submission', async () => {
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.totalFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { data } = await db.from('xp_events').select('amount').eq('user_id', member.userId);
        const expected = (data ?? []).reduce((sum, row) => sum + row.amount, 0);

        expect(result.value).toBe(expected);
        expect(result.value).toBeGreaterThan(0);
    });
});

describe('streakFor', () => {
    it('is 0 for a member with no activity', async () => {
        const member = await sandbox.createUser();

        const result = await xpRepo.streakFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(0);
    });

    it('is 1 the day a member first earns anything', async () => {
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.streakFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(1);
    });
});

describe('historyFor', () => {
    it('returns the awards newest first', async () => {
        const { member } = await aMemberWhoSatAPaper();
        await xpRepo.awardBadges(db, member.userId, [BADGE_A]);

        const result = await xpRepo.historyFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.length).toBeGreaterThanOrEqual(2);

        const times = result.value.map((e) => new Date(e.awardedAt).getTime());
        expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('honours the limit', async () => {
        const { member } = await aMemberWhoSatAPaper();
        await xpRepo.awardBadges(db, member.userId, [BADGE_A, BADGE_B, BADGE_C]);

        const result = await xpRepo.historyFor(db, member.userId, 2);

        expect(result.ok && result.value).toHaveLength(2);
    });

    it('is empty for a member with no ledger rows', async () => {
        const member = await sandbox.createUser();

        const result = await xpRepo.historyFor(db, member.userId);

        expect(result.ok && result.value).toEqual([]);
    });
});

describe('awardBadges', () => {
    it('records a badge and pays XP_PER_BADGE for it', async () => {
        const member = await sandbox.createUser();

        const result = await xpRepo.awardBadges(db, member.userId, [BADGE_A]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual([BADGE_A]);

        const total = await xpRepo.totalFor(db, member.userId);
        expect(total.ok && total.value).toBe(XP_PER_BADGE);
    });

    it('inserts nothing the second time, and says so', async () => {
        // The behaviour the whole read-then-insert exists for. This runs on
        // EVERY render of the profile page; the caller uses the returned codes
        // to say "you earned two badges" rather than re-announcing all of them.
        const member = await sandbox.createUser();

        const first = await xpRepo.awardBadges(db, member.userId, [BADGE_A]);
        expect(first.ok && first.value).toEqual([BADGE_A]);

        const second = await xpRepo.awardBadges(db, member.userId, [BADGE_A]);
        expect(second.ok).toBe(true);
        if (!second.ok) return;

        expect(second.value).toEqual([]);

        const { count } = await db
            .from('xp_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', member.userId)
            .eq('reason', 'badge_earned');

        expect(count).toBe(1);
    });

    it('awards only the codes that are new', async () => {
        const member = await sandbox.createUser();

        await xpRepo.awardBadges(db, member.userId, [BADGE_A]);

        const result = await xpRepo.awardBadges(db, member.userId, [BADGE_A, BADGE_B]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // The one already held is filtered out before the insert. Sending both
        // straight to PostgREST fails the WHOLE batch on 23505 — so BADGE_B
        // would never be awarded, which is the bug the read-then-insert avoids.
        expect(result.value).toEqual([BADGE_B]);
    });

    it('does nothing for an empty list', async () => {
        const member = await sandbox.createUser();

        const result = await xpRepo.awardBadges(db, member.userId, []);

        expect(result.ok && result.value).toEqual([]);
    });

    it('survives being called repeatedly, the way a page render does', async () => {
        // Regression guard for the 42P10 the upsert produced. That failure was
        // not a rare race — it was every single call, so the badges section of
        // the profile page never worked at all.
        const member = await sandbox.createUser();

        for (let i = 0; i < 4; i += 1) {
            const result = await xpRepo.awardBadges(db, member.userId, [BADGE_A, STREAK_BADGE]);
            expect(result.ok, `call ${i + 1}`).toBe(true);
        }

        const { count } = await db
            .from('xp_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', member.userId)
            .eq('reason', 'badge_earned');

        expect(count).toBe(2);
    });
});

describe('badgeAwardsFor', () => {
    it('maps every badge code to when it was awarded', async () => {
        const member = await sandbox.createUser();
        await xpRepo.awardBadges(db, member.userId, [BADGE_A, STREAK_BADGE]);

        const result = await xpRepo.badgeAwardsFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(Object.keys(result.value).sort()).toEqual([BADGE_A, STREAK_BADGE].sort());
        expect(new Date(result.value[BADGE_A]).toString()).not.toBe('Invalid Date');
    });

    it('ignores ledger rows that are not badges', async () => {
        // Submission XP has a null code. Without the `reason` filter it would
        // land in this map under the key "null".
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.badgeAwardsFor(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual({});
    });
});

describe('leaderboard', () => {
    it('ranks members and marks which row is yours', async () => {
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.leaderboard(db, member.userId, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.entries.length).toBeGreaterThan(0);
        expect(result.value.entries.length).toBeLessThanOrEqual(10);

        const ranks = result.value.entries.map((e) => e.rank);
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });

    it('reports the member their own rank out of the total', async () => {
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.leaderboard(db, member.userId, 3);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.myRank).not.toBeNull();
        expect(result.value.myRank!.rank).toBeGreaterThan(0);
        // The total comes from a separate head request, so it counts every
        // ranked member and not just the three that were fetched.
        expect(result.value.myRank!.totalMembers).toBeGreaterThanOrEqual(
            result.value.entries.length,
        );
    });

    it('still ranks a member with no XP, last and on zero', async () => {
        // The `leaderboard` view ranks every member, not only the ones who have
        // earned something — so `myRank` is null for nobody who exists, and the
        // `?? null` branch in this repository is for a user id with no row at
        // all. A member who has done nothing sees themselves at the bottom on
        // 0 XP rather than being told they are not on the board.
        const member = await sandbox.createUser();

        const result = await xpRepo.leaderboard(db, member.userId, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.myRank).not.toBeNull();
        expect(result.value.myRank!.xp).toBe(0);
        expect(result.value.myRank!.rank).toBe(result.value.myRank!.totalMembers);
    });

    it('never renders an empty display name', async () => {
        const { member } = await aMemberWhoSatAPaper();

        const result = await xpRepo.leaderboard(db, member.userId, 10);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.entries.every((e) => e.displayName.trim() !== '')).toBe(true);
    });
});
