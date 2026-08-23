/**
 * The game layer's rules — pure.
 *
 * Stories: SP-101 … SP-105
 *
 * ---------------------------------------------------------------------------
 * WHAT MOVED, AND WHY
 *
 * This file used to compute everything: XP, streaks, badges and daily quests,
 * recomputed from raw rows on every single render and stored nowhere. Its own
 * header was honest about the cost — "no streak freezes, no daily-login credit,
 * and a badge knows the date of the event that earned it only when that event
 * carries one. Those need somewhere to write, and there is nowhere."
 *
 * There is somewhere now: the `xp_events` ledger. So two things left:
 *
 *   computeXp()     -> SUM over the ledger, via the `user_xp_totals` view.
 *                      XP is awarded by trigger when an assessment is submitted
 *                      or a plan item completed, so it has provenance and a
 *                      date, and cannot be quietly recomputed into a different
 *                      number by a change to a formula.
 *
 *   deriveStreak()  -> current_streak() in 0002_functions.sql. It counts days
 *                      with *any* XP activity, where this could only ever count
 *                      days a member took an assessment, because that was the
 *                      one timestamp the old schema recorded.
 *
 * What stayed is what genuinely is a rule rather than a stored fact: which
 * badges a member has earned, and what today's goals are. Those are pure
 * functions over plain arrays, so they test without a database — and the
 * profile service writes newly-earned badges into the ledger, which is where
 * their earned-on date comes from.
 * ---------------------------------------------------------------------------
 *
 * Test: tests/lib/domain/derived.test.ts
 */

import { APP_TIMEZONE, WEAK_AREA_THRESHOLD, XP_PER_ASSESSMENT, XP_PER_SCORE_POINT } from './constants';
import type { AssessmentSummary, Badge, PlanItem, Quest, SkillLevel } from './types';

export interface DerivationInput {
    assessments: AssessmentSummary[];
    plan: PlanItem[];
    levels: SkillLevel[];
    /** Today in APP_TIMEZONE as yyyy-mm-dd. Passed in so this stays pure. */
    today: string;
    /**
     * Badge code -> the ledger's `awarded_at` for it. Supplied by the service
     * from `xp_events`; empty on a first render, after which every earned badge
     * has a real date.
     */
    badgeAwards?: Record<string, string>;
}

/** yyyy-mm-dd for a timestamp, in the app's fixed timezone. */
export function dayOf(timestamp: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date(timestamp));
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

interface BadgeRule {
    code: string;
    name: string;
    description: string;
    icon: string;
    /** True when the member has earned it. */
    earned: (input: DerivationInput) => boolean;
}

const BADGE_RULES: readonly BadgeRule[] = [
    {
        code: 'first_assessment',
        name: 'First Steps',
        description: 'Finish your first assessment.',
        icon: 'flag',
        earned: ({ assessments }) => submitted(assessments).length > 0,
    },
    {
        code: 'perfect_score',
        name: 'Flawless',
        description: 'Score 100% on any assessment.',
        icon: 'target',
        earned: ({ assessments }) => submitted(assessments).some((a) => a.score === 100),
    },
    {
        code: 'explorer',
        name: 'Explorer',
        description: 'Take an assessment in three different categories.',
        icon: 'map',
        earned: ({ assessments }) =>
            new Set(submitted(assessments).map((a) => a.categoryId)).size >= 3,
    },
    {
        code: 'well_rounded',
        name: 'Well Rounded',
        description: 'Reach intermediate or above in three categories.',
        icon: 'layers',
        earned: ({ levels }) => levels.filter((level) => level !== 'beginner').length >= 3,
    },
    {
        code: 'comeback',
        name: 'Comeback',
        description: 'Improve a category score by 20 points or more.',
        icon: 'trending-up',
        earned: ({ assessments }) => {
            const best = new Map<number, number>();

            for (const a of submitted(assessments)) {
                const previous = best.get(a.categoryId);
                if (previous !== undefined && (a.score ?? 0) - previous >= 20) return true;
                best.set(a.categoryId, Math.max(previous ?? 0, a.score ?? 0));
            }

            return false;
        },
    },
    {
        code: 'first_plan_item',
        name: 'Getting to Work',
        description: 'Complete your first learning-plan item.',
        icon: 'check',
        earned: ({ plan }) => plan.some((item) => item.status === 'completed'),
    },
    {
        code: 'plan_finisher',
        name: 'Finisher',
        description: 'Complete every item in a category plan.',
        icon: 'flag-triangle-right',
        earned: ({ plan }) => {
            const byCategory = new Map<number, { total: number; done: number }>();

            for (const item of plan) {
                const bucket = byCategory.get(item.categoryId) ?? { total: 0, done: 0 };
                bucket.total += 1;
                if (item.status === 'completed') bucket.done += 1;
                byCategory.set(item.categoryId, bucket);
            }

            return [...byCategory.values()].some((b) => b.total > 0 && b.total === b.done);
        },
    },
    {
        code: 'sharp_edges',
        name: 'No Weak Spots',
        description: `Have no category scoring under ${WEAK_AREA_THRESHOLD}%.`,
        icon: 'award',
        earned: ({ assessments }) => {
            const latest = latestByCategory(assessments);
            return latest.length >= 2 && latest.every((a) => (a.score ?? 0) >= WEAK_AREA_THRESHOLD);
        },
    },
];

/**
 * The streak badges are not in the list above.
 *
 * They were, and they were wrong: the rule needed a streak, the streak came
 * from this file, and this file could only see assessment dates. A member with
 * a seven-day streak of completed plan items earned nothing. Streaks now come
 * from current_streak() in SQL, so the two streak badges are evaluated by the
 * service, which is the layer that has the number.
 */
export const STREAK_BADGES: readonly { code: string; name: string; description: string; icon: string; days: number }[] = [
    { code: 'streak_7', name: 'Consistent', description: 'Stay active seven days running.', icon: 'flame', days: 7 },
    { code: 'streak_30', name: 'Relentless', description: 'Stay active thirty days running.', icon: 'zap', days: 30 },
];

function submitted(assessments: AssessmentSummary[]): AssessmentSummary[] {
    return assessments
        .filter((a) => a.status === 'submitted')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function latestByCategory(assessments: AssessmentSummary[]): AssessmentSummary[] {
    const latest = new Map<number, AssessmentSummary>();
    for (const a of submitted(assessments)) latest.set(a.categoryId, a);
    return [...latest.values()];
}

/** Which badge codes a member qualifies for right now. */
export function earnedBadgeCodes(input: DerivationInput, streak = 0): string[] {
    const codes = BADGE_RULES.filter((rule) => rule.earned(input)).map((rule) => rule.code);
    const streakCodes = STREAK_BADGES.filter((badge) => streak >= badge.days).map((b) => b.code);

    return [...codes, ...streakCodes];
}

/**
 * The badge wall.
 *
 * `earnedAt` comes from `badgeAwards` — the ledger — rather than from guessing
 * at the date of whichever row happened to satisfy the rule.
 */
export function deriveBadges(input: DerivationInput, streak = 0): Badge[] {
    const earned = new Set(earnedBadgeCodes(input, streak));
    const awards = input.badgeAwards ?? {};

    const all = [
        ...BADGE_RULES.map(({ code, name, description, icon }) => ({ code, name, description, icon })),
        ...STREAK_BADGES.map(({ code, name, description, icon }) => ({ code, name, description, icon })),
    ];

    return all.map((badge, index) => ({
        badgeId: index + 1,
        ...badge,
        earned: earned.has(badge.code),
        earnedAt: awards[badge.code] ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Daily quests
// ---------------------------------------------------------------------------

/**
 * Today's goals.
 *
 * Assessments are still the only per-day activity offered, and the reason is
 * unchanged: a goal that cannot tick is worse than no goal. Plan items now
 * carry `completed_at`, so "complete a plan item today" has become checkable —
 * it is left out only because nothing yet writes plan items, and a quest
 * pointing at an unbuilt page is the same broken promise in a new place. Add it
 * with the plan slice.
 */
export function deriveQuests(input: DerivationInput): Quest[] {
    const todays = submitted(input.assessments).filter((a) => dayOf(a.createdAt) === input.today);

    const categoriesBefore = new Set(
        submitted(input.assessments)
            .filter((a) => dayOf(a.createdAt) !== input.today)
            .map((a) => a.categoryId),
    );

    const freshCategory = todays.some((a) => !categoriesBefore.has(a.categoryId));
    const bestToday = todays.reduce((best, a) => Math.max(best, a.score ?? 0), 0);

    return [
        {
            questId: 1,
            code: 'assess_today',
            name: 'Show up',
            description: 'Finish an assessment today.',
            icon: 'clipboard-check',
            targetCount: 1,
            xpReward: XP_PER_ASSESSMENT,
            progressCount: Math.min(todays.length, 1),
            completedAt: todays[0]?.createdAt ?? null,
        },
        {
            questId: 2,
            code: 'score_well',
            name: 'Sharp today',
            description: 'Score 70% or better on an assessment today.',
            icon: 'target',
            targetCount: 1,
            xpReward: 70 * XP_PER_SCORE_POINT,
            progressCount: bestToday >= 70 ? 1 : 0,
            completedAt: bestToday >= 70 ? (todays[0]?.createdAt ?? null) : null,
        },
        {
            questId: 3,
            code: 'branch_out',
            name: 'Branch out',
            description: 'Assess a category you have never been assessed in.',
            icon: 'map',
            targetCount: 1,
            xpReward: XP_PER_ASSESSMENT,
            progressCount: freshCategory ? 1 : 0,
            completedAt: freshCategory ? (todays[0]?.createdAt ?? null) : null,
        },
    ];
}

/** The level shown beside a member's name: the best they have proved. */
export function deriveOverallLevel(levels: SkillLevel[]): SkillLevel | null {
    if (levels.length === 0) return null;
    if (levels.includes('advanced')) return 'advanced';
    if (levels.includes('intermediate')) return 'intermediate';
    return 'beginner';
}
