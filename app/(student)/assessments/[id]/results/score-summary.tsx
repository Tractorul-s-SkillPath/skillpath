/**
 * The verdict block: score, level, and the per-band breakdown.
 *
 * Stories: SP-116, SP-051
 *
 * The bands are the useful part. "65%" says how it went; "7/7 beginner, 5/7
 * intermediate, 1/6 advanced" says what to do about it — which is why each
 * band gets a real progress bar and not just a number.
 */

import type { BandScore } from '../../../../../lib/domain/baseline';
import type { SkillLevel } from '../../../../../lib/domain/types';
import { levelLabel } from '../../../../../lib/domain/levels';
import { LEVEL_LABELS } from '../../../../../lib/domain/constants';
import { Chip } from '../../../../../components/ui/chip';
import { Progress } from '../../../../../components/ui/progress';
import { formatScore } from '../../../../../lib/utils';

/** Same rule the dashboard uses: only advanced earns the success tone. */
function levelTone(level: SkillLevel): 'success' | 'warm' | 'muted' {
    if (level === 'advanced') return 'success';
    if (level === 'intermediate') return 'warm';
    return 'muted';
}

export function ScoreSummary({
    score,
    level,
    levelCaption,
    bands,
}: {
    score: number;
    level: SkillLevel;
    /** "Starting level" for the baseline, "Your level" for a category run. */
    levelCaption: string;
    bands: BandScore[];
}) {
    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-wide text-subtle-foreground">
                        Your score
                    </p>
                    <p className="mt-1 text-4xl font-semibold tabular text-foreground">
                        {formatScore(score)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-subtle-foreground">
                        {levelCaption}
                    </p>
                    <div className="mt-1.5">
                        <Chip tone={levelTone(level)}>{levelLabel(level)}</Chip>
                    </div>
                </div>
            </div>

            <dl className="mt-6 space-y-4 border-t border-border pt-5">
                {bands.map((band) => (
                    <div key={band.difficulty}>
                        <div className="flex items-baseline justify-between gap-4">
                            <dt className="text-[0.8125rem] font-medium text-foreground">
                                {LEVEL_LABELS[band.difficulty]}
                            </dt>
                            <dd className="text-xs text-muted-foreground tabular">
                                {band.correct} of {band.total} correct
                            </dd>
                        </div>
                        <Progress
                            value={band.correct}
                            max={band.total}
                            label={`${LEVEL_LABELS[band.difficulty]} questions correct`}
                            tone={band.correct === band.total ? 'success' : 'accent'}
                            className="mt-1.5"
                        />
                    </div>
                ))}
            </dl>
        </div>
    );
}
