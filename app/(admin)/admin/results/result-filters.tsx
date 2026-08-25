/**
 * Results filters.
 *
 * Stories: SP-082, SP-085
 *
 * The category dropdown carries ids, not names. Filtering by name meant an
 * `ilike` against the category text, so picking "SQL" also matched "Advanced
 * SQL" and there was no way to ask for only the one you chose.
 *
 * Same plain GET form as the user filters. Do not invent a second pattern for
 * this — if a third list needs one, the shared part moves into
 * components/search-input.tsx.
 */

import { Input } from '../../../../components/ui/field';
import { buttonClass } from '../../../../components/ui/button';
import { SubmitButton } from '../../../../components/submit-button';

interface ResultFiltersProps {
    search: string;
    categoryId: string;
    sort: string;
    categories: Array<{ categoryId: number; name: string }>;
}

export function ResultFilters({ search, categoryId, sort, categories }: ResultFiltersProps) {
    const select =
        'h-9.5 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground';

    return (
        <form method="GET" action="/admin/results" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
                <label htmlFor="result-search" className="block text-[0.8125rem] font-medium">
                    Search
                </label>
                <Input
                    id="result-search"
                    type="search"
                    name="search"
                    defaultValue={search}
                    placeholder="Member name or email"
                />
            </div>

            <div className="space-y-1.5">
                <label htmlFor="result-category" className="block text-[0.8125rem] font-medium">
                    Category
                </label>
                <select
                    id="result-category"
                    name="categoryId"
                    defaultValue={categoryId}
                    className={select}
                >
                    <option value="">All categories</option>
                    {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="result-sort" className="block text-[0.8125rem] font-medium">
                    Sort
                </label>
                <select id="result-sort" name="sort" defaultValue={sort} className={select}>
                    <option value="date_desc">Newest first</option>
                    <option value="date_asc">Oldest first</option>
                    <option value="score_desc">Highest score</option>
                    <option value="score_asc">Lowest score</option>
                </select>
            </div>

            <div className="flex gap-2">
                <SubmitButton variant="primary" pendingLabel="Filtering…">
                    Apply
                </SubmitButton>
                <a href="/admin/results" className={buttonClass('ghost')}>
                    Reset
                </a>
            </div>
        </form>
    );
}

export default ResultFilters;
