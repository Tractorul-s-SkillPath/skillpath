/**
 * Profile service — everything the personal page needs, in one pass.
 *
 * Layer: SERVICE (§3.2). Pages call this; pages never touch a repository.
 * Stories: SP-020, SP-021, SP-022, SP-101 … SP-105
 *
 * WHAT THE RESTRUCTURE CHANGED HERE
 *
 * XP and the streak used to be recomputed on every render from raw assessment
 * and plan rows, and the leaderboard was built by fetching every assessment,
 * every plan item and every student and then filtering the full arrays once per
 * person. All three are now reads: `user_xp_totals`, `current_streak()` and the
 * `leaderboard` view.
 *
 * What is still computed here is what is genuinely a rule — which badges a
 * member qualifies for, and what today's goals are. Newly-earned badges are
 * written to the ledger so they acquire a date; the write is idempotent by
 * unique index, so doing it on every render is safe.
 *
 * Test: tests/lib/services/profile.service.test.ts
 */

import 'server-only';
import { cache } from 'react';
import { createClient } from '../supabase/server';
import * as profileRepo from '../repositories/profile.repo';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as planRepo from '../repositories/plan.repo';
import * as xpRepo from '../repositories/xp.repo';
import {
    deriveBadges,
    deriveOverallLevel,
    deriveQuests,
    earnedBadgeCodes,
} from '../domain/derived';
import { APP_TIMEZONE, LEADERBOARD_SIZE } from '../domain/constants';
import type { AppError } from '../errors';
import { err, ok, unwrapOr, type Result } from '../result';
import type { ProfileDashboard, SkillLevel } from '../domain/types';

/** The app's date. One definition, used for streaks and daily goals alike. */
export function today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}

/**
 * `cache` dedupes this for the whole request.
 *
 * The student layout renders a header on every page and the profile page reads
 * the same rows again underneath it. Without this the two fetch independently.
 */
const loadDashboard = cache(async (userId: string): Promise<Result<ProfileDashboard, AppError>> => {
    const supabase = await createClient();

    const [profile, interests, catalog, assessments, plan, xp, streak] = await Promise.all([
        profileRepo.findByUserId(supabase, userId),
        profileRepo.listInterests(supabase, userId),
        profileRepo.listActiveCategories(supabase),
        assessmentRepo.listByUser(supabase, userId),
        planRepo.listByUser(supabase, userId),
        xpRepo.totalFor(supabase, userId),
        xpRepo.streakFor(supabase, userId),
    ]);

    // Only the member's own row is fatal. Every other section degrades to
    // its empty state rather than taking the whole page down.
    if (!profile.ok) return err(profile.error);

    const interestList = unwrapOr(interests, []);
    const assessmentList = unwrapOr(assessments, []);
    const planList = unwrapOr(plan, []);
    const streakDays = unwrapOr(streak, 0);

    const input = {
        assessments: assessmentList,
        plan: planList,
        levels: interestList.map((interest) => interest.level),
        today: today(),
    };

    // Record anything newly earned, then read every badge date back from the
    // ledger. Both calls are cheap and the write is a no-op once a badge is
    // already there.
    await xpRepo.awardBadges(supabase, userId, earnedBadgeCodes(input, streakDays));

    const [badgeAwards, board] = await Promise.all([
        xpRepo.badgeAwardsFor(supabase, userId),
        xpRepo.leaderboard(supabase, userId, LEADERBOARD_SIZE),
    ]);

    const withAwards = { ...input, badgeAwards: unwrapOr(badgeAwards, {}) };
    const leaderboard = unwrapOr(board, { entries: [], myRank: null });

    return ok({
        profile: profile.value,
        interests: interestList,
        catalog: unwrapOr(catalog, []),
        assessments: assessmentList,
        plan: planList,

        // A badge award is itself XP, so the total is read after the write.
        xp: unwrapOr(await xpRepo.totalFor(supabase, userId), unwrapOr(xp, 0)),
        streak: streakDays,
        lastActiveOn:
            interestList
                .map((interest) => interest.assessedAt)
                .filter((date): date is string => date !== null)
                .sort()
                .at(-1) ?? null,
        overallLevel: deriveOverallLevel(input.levels),
        badges: deriveBadges(withAwards, streakDays),
        quests: deriveQuests(input),
        leaderboard: leaderboard.entries,
        myRank: leaderboard.myRank,
    });
});

export function getProfileDashboard(userId: string): Promise<Result<ProfileDashboard, AppError>> {
    return loadDashboard(userId);
}

/**
 * Just the XP number, for the header on every page.
 *
 * One read of a view. This used to fetch a member's entire assessment history
 * and every plan item they had, on every page, to add three numbers up.
 */
export async function getHeaderXp(userId: string): Promise<number> {
    const supabase = await createClient();
    return unwrapOr(await xpRepo.totalFor(supabase, userId), 0);
}

export async function updateName(
    userId: string,
    firstName: string,
    lastName: string,
): Promise<Result<void, AppError>> {
    const supabase = await createClient();
    return profileRepo.updateName(supabase, userId, {
        first_name: firstName,
        last_name: lastName,
    });
}

export async function setInterests(
    userId: string,
    categoryIds: number[],
): Promise<Result<void, AppError>> {
    const supabase = await createClient();
    return profileRepo.syncInterests(supabase, userId, [...new Set(categoryIds)]);
}

export async function setCategoryLevel(
    userId: string,
    categoryId: number,
    level: SkillLevel,
): Promise<Result<void, AppError>> {
    const supabase = await createClient();
    return profileRepo.setCategoryLevel(supabase, userId, categoryId, level);
}
