/**
 * The four numbers at the top of /admin.
 *
 * Layer: PAGE (presentational)
 * Story: SP-080
 *
 * Takes a domain object, not a database row. A component that reads
 * `stats.total_users` has had a repository row handed to it through two layers
 * that were each supposed to stop that happening (§8).
 *
 * `tabular` keeps the digits from jittering as the numbers change width.
 */

import { Chip } from '../../../components/ui/chip';
import { formatScore } from '../../../lib/utils';
import type { AdminOverview } from '../../../lib/domain/types';

interface TileProps {
    label: string;
    value: string;
    hint?: string;
    tone?: 'default' | 'danger';
}

function Tile({ label, value, hint, tone = 'default' }: TileProps) {
    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                {label}
            </p>
            <p
                className={`mt-1.5 text-2xl font-semibold tabular tracking-tight ${
                    tone === 'danger' ? 'text-danger' : 'text-foreground'
                }`}
            >
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

interface OverviewTilesProps {
    overview: AdminOverview;
    /** Null when nobody has completed an assessment yet — there is no weakest area. */
    weakest: { name: string; averageScore: number } | null;
}

export function OverviewTiles({ overview, weakest }: OverviewTilesProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Members" value={String(overview.totalUsers)} />

            <Tile
                label="Assessments"
                value={String(overview.totalAssessments)}
                hint="Submitted only"
            />

            <Tile
                label="Average score"
                value={overview.totalAssessments > 0 ? formatScore(overview.averageScore) : '—'}
                hint={overview.totalAssessments > 0 ? undefined : 'No results yet'}
            />

            {/*
              An em dash rather than "N/A": with nothing submitted there is no
              weakest area, and printing a category name here on the strength of
              zero assessments would be an answer the data cannot support.
            */}
            {weakest ? (
                <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                        Weakest area
                    </p>
                    <p
                        className="mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground"
                        title={weakest.name}
                    >
                        {weakest.name}
                    </p>
                    <Chip tone="danger" className="mt-1.5">
                        {formatScore(weakest.averageScore)} average
                    </Chip>
                </div>
            ) : (
                <Tile label="Weakest area" value="—" hint="No results yet" />
            )}
        </div>
    );
}

export default OverviewTiles;
