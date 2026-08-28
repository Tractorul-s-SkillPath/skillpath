/**
 * skill_categories table.
 *
 * Layer: REPOSITORY
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * A unique violation is translated into a typed conflict here, not swallowed:
 * fromPostgrestError maps 23505 to `conflict`, and the action turns that into a
 * field error on `name`. A 500 on a duplicate category name is a bug (SP-031 AC2).
 *
 * Test: tests/lib/repositories/category.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentStatus, Database } from '../supabase/database.types';
import { appError, fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../domain/constants';
import type { CatalogCategory, SkillCategory } from '../domain/types';
import { toCatalogCategory, toCategory } from './mappers';

type Client = SupabaseClient<Database>;

/**
 * The admin catalog: every category, active or not, with how many questions it
 * holds.
 *
 * The count comes back from the same request as the rows — `questions(count)`
 * is an aggregate embed, so this is one query rather than one per category.
 * Counting in a loop over the catalog is the N+1 the header of this file has
 * warned about since it was a stub.
 */
export async function listWithQuestionCounts(
    supabase: Client,
): Promise<Result<CatalogCategory[], AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .select('*, questions(count)')
        .order('name');

    if (error) return err(fromPostgrestError(error, 'skill_categories.listWithCounts'));

    return ok(data.map((row) => toCatalogCategory(row, row.questions[0]?.count ?? 0)));
}

/**
 * The categories a student may be assessed in, each with its ACTIVE question
 * count.
 *
 * Same aggregate-embed trick as the admin list above, plus a filter on the
 * embedded rows — `.eq('questions.status', 'active')` counts only what a paper
 * could actually draw from. Whether the count is ENOUGH is the service's rule
 * (MIN_CATEGORY_QUESTIONS), not this query's: too-thin categories are shown
 * disabled with the reason, so hiding them here would be the wrong layer.
 *
 * The baseline's sentinel category is excluded for the same reason
 * profile.repo.listActiveCategories excludes it: the one category nobody may
 * pick is the one the baseline paper lives in (SP-110).
 */
export async function listStartable(
    supabase: Client,
): Promise<Result<CatalogCategory[], AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .select('*, questions(count)')
        .eq('status', 'active')
        .neq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .eq('questions.status', 'active')
        .order('name');

    if (error) return err(fromPostgrestError(error, 'skill_categories.listStartable'));

    return ok(data.map((row) => toCatalogCategory(row, row.questions[0]?.count ?? 0)));
}

/**
 * One category, only if a student is allowed to start an assessment in it:
 * active, and not the baseline's sentinel. Null means "not startable" without
 * saying why — the page already said why, this is the write-path re-check.
 */
export async function findStartable(
    supabase: Client,
    categoryId: number,
): Promise<Result<SkillCategory | null, AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .select('*')
        .eq('category_id', categoryId)
        .eq('status', 'active')
        .neq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'skill_categories.findStartable'));

    return ok(data ? toCategory(data) : null);
}

export async function findById(
    supabase: Client,
    categoryId: number,
): Promise<Result<SkillCategory, AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .select('*')
        .eq('category_id', categoryId)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'skill_categories.findById'));
    if (!data) return err(appError('not_found', 'That category no longer exists.'));

    return ok(toCategory(data));
}

export async function insert(
    supabase: Client,
    name: string,
    description: string,
): Promise<Result<SkillCategory, AppError>> {
    const { data, error } = await supabase
        .from('skill_categories')
        .insert({ name, description })
        .select('*')
        .single();

    if (error) {
        const mapped = fromPostgrestError(error, 'skill_categories.insert');

        // The generic "That already exists." is true but unhelpful next to a
        // name field, and it lands nowhere in particular on the form.
        if (mapped.code === 'conflict') {
            return err(
                appError('conflict', 'A category with that name already exists.', {
                    name: 'A category with that name already exists.',
                }),
            );
        }

        return err(mapped);
    }

    return ok(toCategory(data));
}

/**
 * Deactivation, never a hard delete (SP-032).
 *
 * The foreign keys from `questions` and `assessments` are `on delete restrict`,
 * so the database would refuse a delete anyway — but refusing at the last
 * moment with a constraint error is not the same as never offering it.
 */
export async function setStatus(
    supabase: Client,
    categoryId: number,
    status: ContentStatus,
): Promise<Result<void, AppError>> {
    const { error } = await supabase
        .from('skill_categories')
        .update({ status })
        .eq('category_id', categoryId);

    if (error) return err(fromPostgrestError(error, 'skill_categories.setStatus'));
    return ok(undefined);
}
