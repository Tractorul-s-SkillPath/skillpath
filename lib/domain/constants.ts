/**
 * Every business threshold, once.
 *
 * Stories: SP-051, SP-052, SP-101
 *
 * ---------------------------------------------------------------------------
 * ON THE ONE DUPLICATION IN THIS FILE — READ BEFORE CHANGING A NUMBER
 *
 * The XP amounts and the level thresholds also exist in SQL, in
 * supabase/migrations/0002_functions.sql, as `xp_per_assessment()`,
 * `xp_per_score_point()`, `xp_per_plan_item()` and `level_for_score()`.
 *
 * That is deliberate and it is the price of the restructure. XP used to be
 * recomputed in TypeScript on every render, which made this file the single
 * definition — and also meant XP had no history, badges had no earned-on date,
 * and a streak could only count days a member happened to take an assessment.
 * XP is now awarded by database trigger into the `xp_events` ledger, so the SQL
 * is what actually writes rows.
 *
 * The rule that keeps them honest:
 *
 *   1. The SQL is authoritative. Change it there first.
 *   2. Mirror it here, in the same commit. These constants are for display —
 *      printing "+50 XP" on a button should not need a round trip.
 *
 * NOTHING ENFORCES RULE 2 TODAY. There is no test suite in the project, so a
 * migration that changes xp_per_assessment() to 60 while this file still says
 * 50 will compile, deploy, and show every member a number they were not
 * awarded. The guard is a five-line test that reads the migration and compares
 * the two — worth writing the day tests arrive, and worth knowing about until
 * then. Until it exists, changing an amount is a two-file edit performed by
 * hand, and reviewing one half without the other is how it breaks.
 * ---------------------------------------------------------------------------
 *
 * Never inline these numbers anywhere else — not in a component, not in a test.
 * Mentors will ask where a level comes from and there should be exactly one
 * answer.
 */

import type { SkillLevel } from './types';

/**
 * Score at or above which a member is that level. Checked high to low.
 * Mirrors `level_for_score()` in 0002_functions.sql.
 */
export const LEVEL_THRESHOLDS: ReadonlyArray<{ min: number; level: SkillLevel }> = [
    { min: 80, level: 'advanced' },
    { min: 50, level: 'intermediate' },
    { min: 0, level: 'beginner' },
];

/** Below this, a category is a weak area and earns plan items. */
export const WEAK_AREA_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// The XP economy. Mirrors the three functions in 0002_functions.sql.
// ---------------------------------------------------------------------------

/** Awarded for finishing any assessment, before the score is added. */
export const XP_PER_ASSESSMENT = 50;

/** Per percentage point scored. */
export const XP_PER_SCORE_POINT = 1;

/** Awarded for each completed learning-plan item. */
export const XP_PER_PLAN_ITEM = 40;

/** Awarded once per badge, when the ledger first records it. */
export const XP_PER_BADGE = 25;

// ---------------------------------------------------------------------------
// XP levels — display only. There is no SQL counterpart: the database stores
// XP, and what an XP total is *called* is a presentation rule.
// ---------------------------------------------------------------------------

/** XP to go from level 1 to level 2. */
export const XP_LEVEL_BASE = 200;

/** Each level costs this much more than the one before it. */
export const XP_LEVEL_STEP = 100;

export const LEADERBOARD_SIZE = 10;

/** The timezone every date in the product is expressed in. */
export const APP_TIMEZONE = 'Europe/Bucharest';

/** Human labels for the three levels, used everywhere one is displayed. */
export const LEVEL_LABELS: Record<SkillLevel, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

/** Human labels for plan statuses. The enum is snake_case; members are not. */
export const PLAN_STATUS_LABELS = {
    not_started: 'Not started',
    in_progress: 'In progress',
    completed: 'Completed',
} as const;
