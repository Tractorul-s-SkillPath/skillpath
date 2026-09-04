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
    if (score < 80) return 'bg-amber-500';
    return 'bg-accent';
}

/**
 * The key for the bar colours. Kept next to `toneFor` on purpose — the two have
 * to agree about where the boundaries are, and they will not stay in agreement
 * if they live at opposite ends of the file.
 */
const LEGEND = [
    { label: 'Beginner', range: 'under 50%', tone: 'bg-[color:var(--danger)]' },
    { label: 'Intermediate', range: '50–79%', tone: 'bg-amber-500' },
    { label: 'Advanced', range: '80%+', tone: 'bg-accent' },
];
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
        <>
            {/* The bars are coloured by the same thresholds as a skill level,
                but nothing on the page said so — the tones read as generic
                "bad/ok/good" decoration, and they collide with the danger and
                streak tokens used semantically elsewhere. Naming the bands
                makes the colour a key rather than a mood. */}
            <ul className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                {LEGEND.map((band) => (
                    <li key={band.label} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className={`size-2 rounded-full ${band.tone}`} />
                        {band.label}
                        <span className="text-subtle-foreground tabular">{band.range}</span>
                    </li>
                ))}
            </ul>

            <ol className="space-y-4">
                {ranking.map((category, index) => (
                    <li
                        key={category.categoryId}
                        className={`rise stagger-${Math.min(index + 1, 6)}`}
                    >
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="min-w-0 truncate text-sm font-medium text-foreground">
                                <span className="mr-2 text-subtle-foreground tabular">
                                    #{index + 1}
                                </span>
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
                                className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneFor(category.averageScore)}`}
                                style={{
                                    width: `${Math.max(2, Math.min(100, category.averageScore))}%`,
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ol>
        </>
    );
}

export default WeakCategoriesChart;
