/**
 * Aggregated weak categories across all students.
 *
 * Layer: PAGE (presentational)
 * Story: SP-081
 *
 * Ranked bars, already aggregated server-side by `category_score_summary`
 * (migration 0003). This component receives at most WEAK_CATEGORY_LIMIT rows
 * and does no maths — the one calculation here is a bar width, which is a
 * drawing instruction, not a statistic.
 *
 * The bar is decoration on top of a number that is written out in full beside
 * it. A length alone is not readable to a screen reader and not distinguishable
 * to somebody who cannot separate the tones, so `aria-hidden` covers the bar and
 * the figures carry the meaning.
 */

import { EmptyState } from '../../../components/empty-state';
import { formatScore } from '../../../lib/utils';
import type { CategoryRanking } from '../../../lib/domain/types';

/** The same boundaries as lib/domain/levels.ts, so a bar agrees with a level. */
function toneFor(score: number): string {
    if (score < 50) return 'bg-[color:var(--danger)]';
    if (score < 80) return 'bg-[color:var(--streak)]';
    return 'bg-accent';
}

export function WeakCategoriesChart({ ranking }: { ranking: CategoryRanking[] }) {
    if (ranking.length === 0) {
        return (
            <EmptyState
                title="No results yet"
                description="Once members start submitting assessments, the categories they struggle with most will rank here."
            />
        );
    }

    return (
        <ol className="space-y-4">
            {ranking.map((category, index) => (
                <li key={category.categoryId}>
                    <div className="flex items-baseline justify-between gap-4">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">
                            <span className="mr-2 text-subtle-foreground tabular">#{index + 1}</span>
                            {category.name}
                        </p>

                        <p className="shrink-0 text-[0.8125rem] text-muted-foreground tabular">
                            <span className="font-semibold text-foreground">
                                {formatScore(category.averageScore)}
                            </span>
                            {' · '}
                            {category.assessmentCount}
                            {category.assessmentCount === 1 ? ' assessment' : ' assessments'}
                        </p>
                    </div>

                    <div
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                    >
                        <div
                            className={`h-full rounded-full ${toneFor(category.averageScore)}`}
                            style={{ width: `${Math.max(2, Math.min(100, category.averageScore))}%` }}
                        />
                    </div>
                </li>
            ))}
        </ol>
    );
}

export default WeakCategoriesChart;
