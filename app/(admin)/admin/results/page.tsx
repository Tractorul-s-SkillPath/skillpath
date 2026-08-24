/**
 * All results.
 *
 * Layer: PAGE
 * Stories: SP-082, SP-085, SP-086
 *
 * Member, category, score, level, date. Sorting is an ORDER BY and paging is a
 * range — both in the database, never an Array.sort over ten thousand rows
 * fetched to show ten of them.
 *
 * `level` is derived from the score by lib/domain/levels.ts, in the repository.
 * It is not a column and must not become one: a stored level is a second answer
 * to "how did they do", and the two drift the first time a threshold moves.
 */

import Link from 'next/link';
import { listAllResults } from '../../../../lib/services/admin-stats.service';
import { listCategories } from '../../../../lib/services/category.service';
import { resultFiltersSchema } from '../../../../lib/validation/filters.schema';
import { unwrapOr } from '../../../../lib/result';
import { ResultFilters } from './result-filters';
import { Section } from '../../../../components/ui/card';
import { Chip } from '../../../../components/ui/chip';
import { buttonClass } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/empty-state';
import { Pagination } from '../../../../components/pagination';
import { formatDate, formatScore } from '../../../../lib/utils';

export const metadata = { title: 'Results · SkillPath admin' };

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminResultsPage({ searchParams }: { searchParams: SearchParams }) {
    const raw = await searchParams;

    const filters = resultFiltersSchema.parse({
        search: raw.search,
        categoryId: raw.categoryId,
        sort: raw.sort,
        page: raw.page,
    });

    const [resultsResult, categoriesResult] = await Promise.all([
        listAllResults(filters),
        listCategories(),
    ]);

    const { items, total, page, totalPages } = unwrapOr(resultsResult, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
    });

    // The dropdown failing is not a reason to hide the results; it degrades to
    // "All categories" and the list still renders.
    const categories = unwrapOr(categoriesResult, []);

    const buildHref = (target: number) => {
        const query = new URLSearchParams();

        if (filters.search) query.set('search', filters.search);
        if (filters.categoryId !== null) query.set('categoryId', String(filters.categoryId));
        query.set('sort', filters.sort);
        query.set('page', String(target));

        return `/admin/results?${query}`;
    };

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Results</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {total === 1
                            ? '1 submitted assessment matches'
                            : `${total} submitted assessments match`}{' '}
                        these filters.
                    </p>
                </div>

                <Link href="/admin" className={buttonClass('ghost', 'sm')}>
                    ← Overview
                </Link>
            </header>

            <Section title="Filters" description="Filter state lives in the URL, so it survives a refresh.">
                <ResultFilters
                    search={filters.search}
                    categoryId={filters.categoryId === null ? '' : String(filters.categoryId)}
                    sort={filters.sort}
                    categories={categories}
                />
            </Section>

            <Section title="Submitted assessments" description="In-progress and abandoned runs are not results.">
                {items.length === 0 ? (
                    <EmptyState
                        title="No results match"
                        description="Try a shorter search, a different category, or reset the filters."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-subtle-foreground">
                                    <th scope="col" className="pb-2 pr-4 font-medium">Member</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Category</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Score</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Level</th>
                                    <th scope="col" className="pb-2 font-medium">Submitted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((result) => (
                                    <tr
                                        key={result.assessmentId}
                                        className="border-b border-border last:border-0"
                                    >
                                        <td className="py-3 pr-4">
                                            <p className="font-medium text-foreground">
                                                {result.studentName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{result.email}</p>
                                        </td>
                                        <td className="py-3 pr-4 text-muted-foreground">
                                            {result.categoryName}
                                        </td>
                                        <td className="py-3 pr-4 font-medium tabular text-foreground">
                                            {formatScore(result.score)}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <Chip
                                                tone={
                                                    result.level === 'advanced'
                                                        ? 'success'
                                                        : result.level === 'intermediate'
                                                          ? 'warm'
                                                          : 'muted'
                                                }
                                            >
                                                {result.level}
                                            </Chip>
                                        </td>
                                        <td className="py-3 text-muted-foreground">
                                            {formatDate(result.submittedAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    buildHref={buildHref}
                    label="Result"
                    className="mt-5 border-t border-border pt-4"
                />
            </Section>
        </div>
    );
}
