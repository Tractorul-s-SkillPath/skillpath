/**
 * users, skill_categories, category_progress.
 *
 * Layer: REPOSITORY
 * Stories: SP-020, SP-021, SP-022
 *
 * THE INTEREST MODEL: there is no interests table. A `category_progress` row IS
 * the interest — following a category and having a level in it are the same
 * fact. Adding an interest inserts a row at 'beginner'; removing one deletes it,
 * which discards the recorded level and the last score with it. The UI says so
 * before it happens.
 *
 * There is no RLS behind this client. Every user-scoped query carries an
 * explicit `.eq('user_id', userId)` and that clause is the only thing keeping
 * one member out of another's data. A missing one is a data-leak bug.
 *
 * Test: tests/lib/repositories/profile.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    USER_PUBLIC_COLUMNS,
    type Database,
    type SkillLevel,
    type UserUpdate,
} from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../domain/constants';
import type { Interest, SkillCategory, StudentProfile } from '../domain/types';
import { toCategory, toInterest, toProfile } from './mappers';

type Client = SupabaseClient<Database>;

/**
 * The member's own row.
 *
 * Named columns, not `select('*')`. `users.password` is NOT NULL and read by
 * nothing, and there is no reason for it to travel any further into the app
 * than the row it sits in.
 */
export async function findByUserId(
    supabase: Client,
    userId: string,
): Promise<Result<StudentProfile, AppError>> {
    const { data, error } = await supabase
        .from('users')
        .select(USER_PUBLIC_COLUMNS)
        .eq('user_id', userId)
        .single();

    if (error) return err(fromPostgrestError(error, 'users.findByUserId'));
    return ok(toProfile(data));
}

export async function updateName(
    supabase: Client,
    userId: string,
    patch: UserUpdate,
): Promise<Result<void, AppError>> {
    const { error } = await supabase.from('users').update(patch).eq('user_id', userId);

    if (error) return err(fromPostgrestError(error, 'users.updateName'));
    return ok(undefined);
}

/**
 * The catalog a member can pick from.
 *
 * `skill_categories.status` is a real column now, so "active catalog" is a
 * filter rather than a comment explaining that every row is active because
 * there is nowhere to say otherwise.
 *
 * The baseline's sentinel category is excluded HERE, at the source both the
 * register picker and the profile catalog read from. "Pickable" is this
 * function's contract, and the one category a member may not choose, follow
 * or retake is the one the baseline paper lives in (SP-110).
 */
export async function listActiveCategories(
    supabase: Client,
): Promise<Result<SkillCategory[], AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .select('*')
        .eq('status', 'active')
        .neq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .order('name');

    if (error) return err(fromPostgrestError(error, 'skill_categories.list'));
    return ok(data.map(toCategory));
}

/**
 * The member's interests, each with its level and most recent score.
 *
 * One query. The score used to require a second read of the whole assessment
 * history plus a newest-per-category pass in JavaScript; the grading trigger
 * writes `last_score` and `last_assessed_at` onto this row instead.
 */
export async function listInterests(
    supabase: Client,
    userId: string,
): Promise<Result<Interest[], AppError>> {
    const { data, error } = await supabase
        .from('category_progress')
        .select('*, skill_categories(name)')
        .eq('user_id', userId);

    if (error) return err(fromPostgrestError(error, 'category_progress.list'));

    return ok(
        data
            .map((row) => toInterest(row, row.skill_categories?.name ?? 'Unknown category'))
            .sort((a, b) => a.name.localeCompare(b.name)),
    );
}

/**
 * Add and remove interests to match the given set.
 *
 * A diff rather than delete-then-insert, precisely because the row carries the
 * member's level and last score: wiping and re-inserting would reset every
 * level to 'beginner' and lose every recorded score.
 *
 * The insert is an upsert against `category_progress_unique`, so two tabs
 * submitting the same new interest produce one row rather than a duplicate —
 * which the old schema, with no unique constraint, could not prevent.
 */
export async function syncInterests(
    supabase: Client,
    userId: string,
    categoryIds: number[],
): Promise<Result<void, AppError>> {
    const { data: existing, error } = await supabase
        .from('category_progress')
        .select('category_id')
        .eq('user_id', userId);

    if (error) return err(fromPostgrestError(error, 'category_progress.listForSync'));

    const current = new Set(existing.map((row) => row.category_id));
    const wanted = new Set(categoryIds);

    const toAdd = [...wanted].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !wanted.has(id));

    if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('category_progress').upsert(
            toAdd.map((category_id) => ({
                user_id: userId,
                category_id,
                current_level: 'beginner' as SkillLevel,
                last_score: null,
                last_assessed_at: null,
            })),
            { onConflict: 'user_id,category_id', ignoreDuplicates: true },
        );

        if (insertError) return err(fromPostgrestError(insertError, 'category_progress.insert'));
    }

    if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
            .from('category_progress')
            .delete()
            .eq('user_id', userId)
            .in('category_id', toRemove);

        if (deleteError) return err(fromPostgrestError(deleteError, 'category_progress.delete'));
    }

    return ok(undefined);
}

/**
 * Self-declaring a level for one category.
 *
 * The same column the grading trigger writes, so an assessment result
 * overwrites a self-declared level rather than sitting beside it. One answer to
 * "what level am I", and the newer evidence wins.
 */
export async function setCategoryLevel(
    supabase: Client,
    userId: string,
    categoryId: number,
    level: SkillLevel,
): Promise<Result<void, AppError>> {
    const { error } = await supabase
        .from('category_progress')
        .update({ current_level: level })
        .eq('user_id', userId)
        .eq('category_id', categoryId);

    if (error) return err(fromPostgrestError(error, 'category_progress.setLevel'));
    return ok(undefined);
}
