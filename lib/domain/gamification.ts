/**
 * XP levels — pure.
 *
 * Story: SP-101
 *
 * XP levels are NOT skill levels, and the distinction is deliberate. Skill
 * level (beginner/intermediate/advanced) is evidence: an assessment produced
 * it. An XP level is effort: showing up, finishing plan items, keeping a
 * streak. Feeding one into the other would let somebody grind daily quests
 * into "advanced", which devalues every assessment on the page.
 *
 * The curve: level 1 -> 2 costs XP_LEVEL_BASE, and every level after costs
 * XP_LEVEL_STEP more than the last. Early levels arrive fast, later ones don't.
 *
 * Test: tests/lib/domain/gamification.test.ts
 */

import { XP_LEVEL_BASE, XP_LEVEL_STEP } from './constants';

export interface XpStanding {
    /** 1-based. Everybody starts at level 1 with 0 XP. */
    level: number;
    /** XP earned inside the current level. */
    into: number;
    /** XP the current level costs in total. */
    span: number;
    /** XP still to go. 0 only at exactly a level boundary. */
    remaining: number;
    /** 0–100, for the bar. */
    percent: number;
    totalXp: number;
}

/** What the jump from `level` to `level + 1` costs. */
export function xpForLevel(level: number): number {
    if (level < 1) return XP_LEVEL_BASE;
    return XP_LEVEL_BASE + (level - 1) * XP_LEVEL_STEP;
}

/** Cumulative XP needed to have reached `level`. Level 1 is free. */
export function xpToReachLevel(level: number): number {
    let total = 0;
    for (let n = 1; n < level; n += 1) {
        total += xpForLevel(n);
    }
    return total;
}

export function standingFromXp(totalXp: number): XpStanding {
    const xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;

    let level = 1;
    let floor = 0;

    // Bounded by construction: each step costs at least XP_LEVEL_BASE, so this
    // cannot spin even on an absurd XP total.
    while (xp >= floor + xpForLevel(level)) {
        floor += xpForLevel(level);
        level += 1;
    }

    const span = xpForLevel(level);
    const into = xp - floor;

    return {
        level,
        into,
        span,
        remaining: span - into,
        percent: Math.round((into / span) * 100),
        totalXp: xp,
    };
}

/**
 * Streak copy. A streak that is about to break is the single most effective
 * nudge in the product, so it gets its own wording rather than a bare number.
 */
export function describeStreak(
    currentStreak: number,
    lastActivityDate: string | null,
    today: string,
): { headline: string; atRisk: boolean } {
    if (currentStreak === 0 || !lastActivityDate) {
        return { headline: 'No streak yet', atRisk: false };
    }

    const days = `${currentStreak} day${currentStreak === 1 ? '' : 's'}`;

    if (lastActivityDate === today) {
        return { headline: `${days} — counted for today`, atRisk: false };
    }

    return { headline: `${days} — keep it alive`, atRisk: true };
}
