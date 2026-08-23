/**
 * Level estimation — pure.
 *
 * Story: SP-051
 *
 * ON THE DIFFICULTY NUDGE the sketch asked for: not implemented, deliberately.
 * Grading runs inside the database (grade_assessment(), migration 0003) because
 * the answer key is unreachable over the API. A nudge applied here and not
 * there would mean the level shown on the profile disagrees with the level
 * written to category_progress — two answers to "what level am I", which is
 * exactly the failure this file exists to prevent.
 *
 * If the nudge is wanted, it goes into the SQL function first and this mirrors
 * it. The boundary tests below pin both.
 *
 * Boundary cases 49.9 / 50 / 79.9 / 80 each get their own test (SP-051 AC2).
 *
 * Test: tests/lib/domain/levels.test.ts
 */

import { LEVEL_THRESHOLDS, LEVEL_LABELS } from './constants';
import type { SkillLevel } from './types';

export function estimateLevel(percentage: number): SkillLevel {
    const score = Number.isFinite(percentage) ? percentage : 0;
    const match = LEVEL_THRESHOLDS.find((t) => score >= t.min);
    return match?.level ?? 'beginner';
}

export function levelLabel(level: SkillLevel | null): string {
    return level ? LEVEL_LABELS[level] : 'Not set';
}
