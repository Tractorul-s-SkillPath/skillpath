/**
 * Progress maths — pure.
 *
 * Stories: SP-054, SP-070, SP-072
 *
 * Two of the three functions this file was sketched around now exist, because
 * the dashboard needs them and the page layer is not allowed to do arithmetic
 * (§3). `nextLevelFor(currentLevel, latestScore)` is deliberately still absent:
 * nothing calls it, and the level written to `category_progress` comes from
 * `grade_assessment()` in SQL — a second implementation here would be a second
 * answer to "what level am I", which is the failure lib/domain/levels.ts exists
 * to prevent. Add it when a caller needs it, mirroring the SQL.
 *
 * Zero items -> 0, never NaN, never a division by zero rendered as "%".
 *
 * Test: tests/lib/domain/progress.test.ts
 */

import type { PlanStatus } from './types';

/** Only what the maths needs — any PlanItem satisfies this. */
export interface Completable {
    status: PlanStatus;
}

export interface CategoryCompletion {
    completed: number;
    total: number;
}

/** Whole percent, 0–100. An empty plan is 0% done, not 100% and not NaN. */
export function completionRate(items: readonly Completable[]): number {
    if (items.length === 0) return 0;

    const done = items.filter((item) => item.status === 'completed').length;

    return Math.round((done / items.length) * 100);
}

/**
 * Completion across every category at once (SP-072).
 *
 * Items are pooled rather than averaging the per-category percentages: a
 * category holding one item would otherwise weigh as much as one holding
 * twenty, and a member who finished the single item in a category they barely
 * follow would see their overall number jump.
 *
 * Categories with no plan items contribute nothing in either direction.
 */
export function overallCompletion(byCategory: readonly CategoryCompletion[]): number {
    let completed = 0;
    let total = 0;

    for (const category of byCategory) {
        // A hand-built object could carry nonsense; clamp rather than trust.
        const categoryTotal = Math.max(0, category.total);

        completed += Math.min(Math.max(0, category.completed), categoryTotal);
        total += categoryTotal;
    }

    if (total === 0) return 0;

    return Math.round((completed / total) * 100);
}
