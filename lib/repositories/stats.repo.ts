/**
 * Admin aggregates — SQL, not JavaScript.
 *
 * Layer: REPOSITORY
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * overviewCounts() and weakCategoryRanking() each read a view from migration
 * 0003, because PostgREST has no GROUP BY: the alternative is pulling every
 * assessment row across the wire and reducing it in JavaScript, which is the
 * exact thing SP-081 exists to prevent.
 *
 * resultsPaged() needs no view. It is a join with filters, an ORDER BY and a
 * range — all of which PostgREST does natively — and the count comes back on
 * the same request as the rows.
 *
 * There is no RLS behind this client (ARCHITECTURE §5). Nothing in this file is
 * user-scoped, which is precisely why every caller must be behind assertAdmin().
 *
 * Test: tests/lib/repositories/stats.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import { estimateLevel } from '../domain/levels';
import type { AdminOverview, AdminResult, CategoryRanking, Page } from '../domain/types';
import { toAdminOverview, toCategoryRanking } from './mappers';
import { likeTerm, pageRange, toPage } from './paging';

type Client = SupabaseClient<Database>;

export type ResultSort = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc';

export interface ResultFilters {
    search: string;
    categoryId: number | null;
    sort: ResultSort;
    page: number;
    pageSize: number;
}

/**
 * The overview tiles.
 *
 * `.single()` is safe here without a fallback: `admin_overview` is built from
 * scalar subqueries with coalesce, so it returns one row on an empty database
 * too. That is a property of the view, and 0003 says so where it is defined.
 */
export async function overviewCounts(supabase: Client): Promise<Result<AdminOverview, AppError>> {
    const { data, error } = await supabase.from('admin_overview').select('*').single();

    if (error) return err(fromPostgrestError(error, 'admin_overview.read'));
    return ok(toAdminOverview(data));
}

/**
 * Categories ranked weakest first.
 *
 * Bounded by `limit`. An aggregate has at most one row per category so this
 * cannot run away, but a page that renders "the weak areas" wants the head of
 * the list, not all of it.
 */
export async function weakCategoryRanking(
    supabase: Client,
    limit: number,
): Promise<Result<CategoryRanking[], AppError>> {
    const { data, error } = await supabase
        .from('category_score_summary')
        .select('*')
        .order('average_score', { ascending: true })
        // Ties would otherwise come back in whatever order the planner chose,
        // so two refreshes could show two different "weakest" categories.
        .order('category_id', { ascending: true })
        .limit(limit);

    if (error) return err(fromPostgrestError(error, 'category_score_summary.rank'));
    return ok(data.map(toCategoryRanking));
}

const SORT_COLUMN: Record<
    ResultSort,
    { column: 'submitted_at' | 'total_score'; ascending: boolean }
> = {
    date_desc: { column: 'submitted_at', ascending: false },
    date_asc: { column: 'submitted_at', ascending: true },
    score_desc: { column: 'total_score', ascending: false },
    score_asc: { column: 'total_score', ascending: true },
};

/**
 * Every submitted assessment, filtered, sorted and paged in the database.
 *
 * `!inner` on both embeds is load-bearing twice over: it makes the join an
 * inner one, and it is what allows the `users` search below to filter the
 * PARENT rows. Without it PostgREST applies an embedded filter to the embed
 * only — every assessment still comes back, some of them with a null student —
 * which reads as "the search did nothing".
 *
 * `status = 'submitted'` is the whole definition of a result. An in-progress
 * run has no score and the check constraint in 0001 guarantees it, so listing
 * one here would print an empty percentage.
 */
export async function resultsPaged(
    supabase: Client,
    filters: ResultFilters,
): Promise<Result<Page<AdminResult>, AppError>> {
    const { from, to } = pageRange(filters.page, filters.pageSize);
    const order = SORT_COLUMN[filters.sort];

    let query = supabase
        .from('assessments')
        .select(
            'assessment_id, total_score, submitted_at, users!inner(first_name, last_name, email), skill_categories!inner(name)',
            { count: 'exact' },
        )
        .eq('status', 'submitted');

    if (filters.categoryId !== null) {
        // By id, not by name. Matching a category by an ilike on its name — as
        // the first draft of this screen did — silently also matches every
        // other category whose name contains it.
        query = query.eq('category_id', filters.categoryId);
    }

    if (filters.search) {
        const term = likeTerm(filters.search);

        query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`, {
            referencedTable: 'users',
        });
    }

    const { data, count, error } = await query
        .order(order.column, { ascending: order.ascending })
        // A stable tiebreak, so paging cannot show the same row twice or skip
        // one when several assessments share a timestamp or a score.
        .order('assessment_id', { ascending: false })
        .range(from, to);

    if (error) return err(fromPostgrestError(error, 'assessments.resultsPaged'));

    const items = data.map((row): AdminResult => {
        const score = Number(row.total_score ?? 0);

        return {
            assessmentId: row.assessment_id,
            studentName: `${row.users.first_name} ${row.users.last_name}`.trim() || row.users.email,
            email: row.users.email,
            categoryName: row.skill_categories.name,
            score,
            // Derived, never stored. The same rule the student's own results
            // page uses, from the same function — see mappers.toAssessment.
            level: estimateLevel(score),
            // Non-null for a submitted assessment by check constraint, but the
            // column is nullable in the type, so the fallback is spelled out.
            submittedAt: row.submitted_at ?? '',
        };
    });

    return ok(toPage(items, count, filters.page, filters.pageSize));
}
