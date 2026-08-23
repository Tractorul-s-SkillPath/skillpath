/**
 * Admin overview.
 *
 * Layer: PAGE — fetch through services, render. Never a repository (§3.2).
 * Stories: SP-080, SP-081
 *
 * Both reads are aggregates from migration 0003, fetched in parallel. Neither
 * is fatal: a failing tile row or a failing ranking degrades to its empty state
 * rather than taking the whole screen down, because an admin arriving to check
 * one number should not be met with a 500 because the other one failed.
 */

import Link from 'next/link';
import { getOverview, getWeakCategoryRanking } from '../../../lib/services/admin-stats.service';
import { unwrapOr } from '../../../lib/result';
import { Section } from '../../../components/ui/card';
import { buttonClass } from '../../../components/ui/button';
import { OverviewTiles } from './overview-tiles';
import { WeakCategoriesChart } from './weak-categories-chart';

export const metadata = { title: 'Overview · SkillPath admin' };

// Every number here changes as members use the app.
export const dynamic = 'force-dynamic';

const EMPTY_OVERVIEW = { totalUsers: 0, totalAssessments: 0, averageScore: 0 };

export default async function AdminOverviewPage() {
    const [overviewResult, rankingResult] = await Promise.all([
        getOverview(),
        getWeakCategoryRanking(),
    ]);

    const overview = unwrapOr(overviewResult, EMPTY_OVERVIEW);
    const ranking = unwrapOr(rankingResult, []);

    // The ranking is ordered weakest-first by the query, so the head of it is
    // the tile's answer. Computing it twice — once for the tile, once for the
    // table — is how the two end up disagreeing.
    const weakest = ranking[0]
        ? { name: ranking[0].name, averageScore: ranking[0].averageScore }
        : null;

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        Admin overview
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Platform activity and where members are struggling.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link href="/admin/categories" className={buttonClass('primary', 'sm')}>
                        Categories
                    </Link>
                    <Link href="/admin/users" className={buttonClass('secondary', 'sm')}>
                        Members
                    </Link>
                    <Link href="/admin/results" className={buttonClass('secondary', 'sm')}>
                        Results
                    </Link>
                </div>
            </header>

            <OverviewTiles overview={overview} weakest={weakest} />

            <Section
                title="Areas needing attention"
                description="Categories ranked from the lowest average score up, across every member."
            >
                <WeakCategoriesChart ranking={ranking} />
            </Section>
        </div>
    );
}
