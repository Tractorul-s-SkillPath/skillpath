/**
 * users table, from the administrator's side.
 *
 * Layer: REPOSITORY
 * Stories: SP-083, SP-014
 *
 * profile.repo.ts also reads `users`, but only ever the caller's own row. This
 * file is the other half: every member, which is why nothing here takes a
 * `userId` to scope by and why every caller must be behind assertAdmin().
 *
 * `password` is never selected. USER_PUBLIC_COLUMNS is the shape, for the same
 * reason it is on the student side — the column is read by nothing and has no
 * business travelling into a table component.
 *
 * Test: tests/lib/repositories/user.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    USER_PUBLIC_COLUMNS,
    type Database,
    type UserRole,
    type UserStatus,
} from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { ManagedUser, Page } from '../domain/types';
import { toManagedUser } from './mappers';
import { likeTerm, pageRange, toPage } from './paging';

type Client = SupabaseClient<Database>;

export interface UserFilters {
    search: string;
    role: UserRole | null;
    status: UserStatus | null;
    page: number;
    pageSize: number;
}

/**
 * The user-management table: searched, filtered, and paged in the database.
 *
 * This used to return every row and let the page render all of them. That is
 * fine at eight users and a memory problem at eight thousand, and the moment it
 * stops being fine is not one anybody notices in review.
 */
export async function listPaged(
    supabase: Client,
    filters: UserFilters,
): Promise<Result<Page<ManagedUser>, AppError>> {
    const { from, to } = pageRange(filters.page, filters.pageSize);

    let query = supabase.from('users').select(USER_PUBLIC_COLUMNS, { count: 'exact' });

    if (filters.role !== null) query = query.eq('role', filters.role);
    if (filters.status !== null) query = query.eq('status', filters.status);

    if (filters.search) {
        const term = likeTerm(filters.search);
        query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
    }

    // ---------------------------------------------------------------------
    // created_at, NOT user_id. THIS ORDERING WAS SILENTLY BROKEN BY THE UUID
    // MIGRATION.
    // ---------------------------------------------------------------------
    //
    // `order('user_id', { ascending: false })` meant "newest first" only while
    // user_id was a monotonically increasing identity integer. It is now the
    // auth.users UUID, which is random — so the admin users table was sorting
    // members into an arbitrary order while still calling it newest-first.
    //
    // Nothing threw. The list rendered, paged and searched correctly; it was
    // just in the wrong order, and page 2 was not the second-newest twenty
    // members but an arbitrary twenty. tests/lib/repositories/user.repo.test.ts
    // caught it as "expected 7 to be less than 3".
    //
    // user_id stays as the tiebreak. Two members can share a created_at — the
    // seed inserts several in one statement — and without a second key their
    // relative order is whatever the planner chose, which makes a paged list
    // able to show the same row twice or skip one.
    const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: false })
        .range(from, to);

    if (error) return err(fromPostgrestError(error, 'users.listPaged'));

    return ok(toPage(data.map(toManagedUser), count, filters.page, filters.pageSize));
}

export async function setStatus(
    supabase: Client,
    userId: string,
    status: UserStatus,
): Promise<Result<void, AppError>> {
    const { error } = await supabase.from('users').update({ status }).eq('user_id', userId);

    if (error) return err(fromPostgrestError(error, 'users.setStatus'));
    return ok(undefined);
}
