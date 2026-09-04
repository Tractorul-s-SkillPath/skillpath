/**
 * xp_events — the XP ledger, plus the two views over it.
 *
 * Layer: REPOSITORY
 * Stories: SP-101 … SP-105
 *
 * The ledger is append-only. Nothing in this file updates or deletes a row, and
 * nothing should: a total is a SUM, and an award that turns out to be wrong is
 * corrected by a compensating row, never by editing history.
 *
 * Most rows are written by the triggers in 0002_functions.sql — submitting an
 * assessment and completing a plan item both award XP inside the database, so
 * the award cannot be lost by an application that forgot to make a second call.
 * The one thing written from here is a badge, because whether a badge is earned
 * is a rule (lib/domain/derived.ts) rather than a row change.
 *
 * Test: tests/lib/repositories/xp.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import { XP_PER_BADGE } from '../domain/constants';
import type { LeaderboardEntry, MyRank, XpEntry } from '../domain/types';

type Client = SupabaseClient<Database>;

/** A member's total XP. One indexed read of the `user_xp_totals` view. */
export async function totalFor(
    supabase: Client,
    userId: string,
): Promise<Result<number, AppError>> {
    const { data, error } = await supabase
        .from('user_xp_totals')
        .select('total_xp')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'user_xp_totals.totalFor'));
    return ok(data?.total_xp ?? 0);
}

/**
 * Consecutive days of activity, ending today or yesterday.
 *
 * SQL rather than TypeScript because the ledger is where activity is recorded.
 * The old implementation could only count days a member took an assessment,
 * since that was the single timestamp on the old schema.
 */
export async function streakFor(
    supabase: Client,
    userId: string,
): Promise<Result<number, AppError>> {
    const { data, error } = await supabase.rpc('current_streak', { p_user_id: userId });

    if (error) return err(fromPostgrestError(error, 'xp_events.streakFor'));
    return ok(Number(data ?? 0));
}

/** The most recent awards, for a "why do I have this much XP" list. */
export async function historyFor(
    supabase: Client,
    userId: string,
    limit = 20,
): Promise<Result<XpEntry[], AppError>> {
    const { data, error } = await supabase
        .from('xp_events')
        .select('amount, reason, awarded_at')
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false })
        .limit(limit);

    if (error) return err(fromPostgrestError(error, 'xp_events.historyFor'));

    return ok(
        data.map((row) => ({
            amount: row.amount,
            reason: row.reason,
            awardedAt: row.awarded_at,
        })),
    );
}

/** Badge code -> when it was awarded. The source of every badge date shown. */
export async function badgeAwardsFor(
    supabase: Client,
    userId: string,
): Promise<Result<Record<string, string>, AppError>> {
    const { data, error } = await supabase
        .from('xp_events')
        .select('code, awarded_at')
        .eq('user_id', userId)
        .eq('reason', 'badge_earned');

    if (error) return err(fromPostgrestError(error, 'xp_events.badgeAwardsFor'));

    const awards: Record<string, string> = {};
    for (const row of data) {
        if (row.code) awards[row.code] = row.awarded_at;
    }

    return ok(awards);
}

/**
 * Record newly-earned badges.
 *
 * Idempotent by index, not by care: `xp_events_badge_once` is a partial unique
 * index on (user_id, code), so calling this on every profile render — which is
 * exactly what happens — inserts a badge the first time and nothing after.
 *
 * Returns the codes actually inserted, so a caller can say "you earned two
 * badges" rather than re-announcing everything a member already had.
 */
export async function awardBadges(
    supabase: Client,
    userId: string,
    codes: string[],
): Promise<Result<string[], AppError>> {
    if (codes.length === 0) return ok([]);

    // WHY THIS IS A READ-THEN-INSERT AND NOT AN UPSERT
    //
    // `xp_events_badge_once` is a PARTIAL unique index — (user_id, code) WHERE
    // reason = 'badge_earned'. Postgres will only use a partial index for ON
    // CONFLICT if the statement repeats the predicate, and PostgREST's
    // `on_conflict=` takes column names with nowhere to put a WHERE. So the
    // upsert this used to be could never match an index: every call failed with
    // 42P10, "there is no unique or exclusion constraint matching the ON
    // CONFLICT specification", on every render of the profile page.
    //
    // Making the index total is not the fix. `xp_events_quest_once_per_day` is
    // (user_id, code, awarded_on) precisely because a daily quest repeats the
    // same code on different days; a total unique index on (user_id, code)
    // would forbid that.
    const { data: existing, error: readError } = await supabase
        .from('xp_events')
        .select('code')
        .eq('user_id', userId)
        .eq('reason', 'badge_earned')
        .in('code', codes);

    if (readError) return err(fromPostgrestError(readError, 'xp_events.listAwardedBadges'));

    const already = new Set(existing.map((row) => row.code));
    const missing = codes.filter((code) => !already.has(code));

    if (missing.length === 0) return ok([]);

    const { data, error } = await supabase
        .from('xp_events')
        .insert(
            missing.map((code) => ({
                user_id: userId,
                amount: XP_PER_BADGE,
                reason: 'badge_earned' as const,
                assessment_id: null,
                recommendation_id: null,
                code,
            })),
        )
        .select('code');

    if (error) {
        // Two requests racing on the same badge. The index is the authority and
        // this one lost, which means the badge is awarded — the outcome we
        // wanted. Any other badge in the same insert is retried on the next
        // render, because this runs every time the profile page loads.
        if (error.code === '23505') return ok([]);

        return err(fromPostgrestError(error, 'xp_events.awardBadges'));
    }

    return ok(data.map((row) => row.code).filter((code): code is string => code !== null));
}

/**
 * The top of the leaderboard, plus where this member sits.
 *
 * One query against the `leaderboard` view, which ranks in SQL. This used to be
 * three unbounded reads — every assessment, every plan row, every student —
 * followed by a filter over the full arrays once per person.
 */
export async function leaderboard(
    supabase: Client,
    currentUserId: string,
    size: number,
): Promise<Result<{ entries: LeaderboardEntry[]; myRank: MyRank | null }, AppError>> {
    const [top, mine, total] = await Promise.all([
        supabase.from('leaderboard').select('*').order('rank', { ascending: true }).limit(size),
        supabase.from('leaderboard').select('*').eq('user_id', currentUserId).maybeSingle(),
        supabase.from('leaderboard').select('*', { count: 'exact', head: true }),
    ]);

    if (top.error) return err(fromPostgrestError(top.error, 'leaderboard.top'));

    const entries = top.data.map((row) => ({
        rank: row.rank,
        displayName: row.display_name || 'Member',
        xp: row.total_xp,
        isYou: row.user_id === currentUserId,
    }));

    const myRank = mine.data
        ? {
              rank: mine.data.rank,
              xp: mine.data.total_xp,
              totalMembers: total.count ?? entries.length,
          }
        : null;

    return ok({ entries, myRank });
}
