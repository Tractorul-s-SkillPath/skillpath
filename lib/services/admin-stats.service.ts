/**
 * Admin aggregates.
 *
 * Layer: SERVICE
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * Every function here starts with assertAdmin(). The layout at
 * app/(admin)/layout.tsx also calls it, and that is not redundant: the layout
 * guard stops a student *navigating* to the page, and this one stops a request
 * that never rendered a page at all. With no RLS underneath (ARCHITECTURE §5)
 * these checks are the only thing standing between a signed-in student and
 * every other member's results.
 *
 * The weak-category ranking is ONE read of an aggregate view, never "select all
 * assessments and count in JS" (SP-081). See supabase/migrations/0003.
 *
 * Test: tests/lib/services/admin-stats.service.test.ts
 */

import 'server-only';
import { assertAdmin } from '../auth/assertAdmin';
// createServiceClient, NOT createClient: RLS has no admin policy, deliberately.
//
// The policies in *_securitate_rls.sql are all `auth.uid()` = own rows, plus
// read-only SELECT on the content bank. An admin client on the anon key is
// therefore refused every write here — `42501 new row violates row-level
// security policy for table "skill_categories"` was this file creating a
// category through the member's own session.
//
// The fix is not an is_admin() policy. That would put the role check in the
// database AND in assertAdmin(), where the two can drift; ARCHITECTURE §5c puts
// it in one place. EVERY exported function below calls assertAdmin() before it
// touches this client, and that is the whole of the authorization story.
import { createServiceClient } from '../supabase/server';
import * as statsRepo from '../repositories/stats.repo';
import {
    PAGE_SIZE,
    WEAK_CATEGORY_LIMIT,
    type ResultFilterInput,
} from '../validation/filters.schema';
import type { AppError } from '../errors';
import type { Result } from '../result';
import type { AdminOverview, AdminResult, CategoryRanking, Page } from '../domain/types';

export async function getOverview(): Promise<Result<AdminOverview, AppError>> {
    await assertAdmin();
    return statsRepo.overviewCounts(createServiceClient());
}

export async function getWeakCategoryRanking(): Promise<Result<CategoryRanking[], AppError>> {
    await assertAdmin();
    return statsRepo.weakCategoryRanking(createServiceClient(), WEAK_CATEGORY_LIMIT);
}

/**
 * Every submitted assessment, filtered and paged.
 *
 * The page size is set here rather than taken from the caller: a URL is not
 * allowed to ask for ten thousand rows.
 */
export async function listAllResults(
    filters: ResultFilterInput,
): Promise<Result<Page<AdminResult>, AppError>> {
    await assertAdmin();

    return statsRepo.resultsPaged(createServiceClient(), {
        search: filters.search,
        categoryId: filters.categoryId,
        sort: filters.sort,
        page: filters.page,
        pageSize: PAGE_SIZE,
    });
}
