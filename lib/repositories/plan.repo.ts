/**
 * recommendation_plans table.
 *
 * Layer: REPOSITORY
 * Stories: SP-060, SP-061, SP-062, SP-065
 *
 * A member may change `progress_status` and nothing else. With no RLS
 * underneath, that restriction lives here — setStatus() is the only write path
 * and it sends exactly one column.
 *
 * `priority` and `assessment_id` are real columns now. Ordering used to be by
 * primary key with a comment explaining that there was nothing better to order
 * by, and "the plan from the latest assessment" (SP-065) could not be asked for
 * at all.
 *
 * Test: tests/lib/repositories/plan.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PlanStatus } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { PlanItem } from '../domain/types';
import { toPlanItem } from './mappers';

type Client = SupabaseClient<Database>;

/** What a generator provides; user, category and assessment come from the service. */
export interface NewPlanItem {
    topicTitle: string;
    description: string;
    priority: number;
}

/**
 * Write a freshly generated plan, one statement.
 *
 * `progress_status` and `completed_at` are left to their defaults — a new item
 * is `not_started` by definition. `assessment_id` records which run produced
 * the advice (SP-065's "latest assessment wins" needs to know).
 */
export async function insertMany(
    supabase: Client,
    userId: string,
    categoryId: number,
    assessmentId: number,
    items: NewPlanItem[],
): Promise<Result<void, AppError>> {
    if (items.length === 0) return ok(undefined);

    const { error } = await supabase.from('recommendation_plans').insert(
        items.map((item) => ({
            user_id: userId,
            category_id: categoryId,
            assessment_id: assessmentId,
            topic_title: item.topicTitle,
            rule_description: item.description,
            priority: item.priority,
        })),
    );

    if (error) return err(fromPostgrestError(error, 'recommendation_plans.insertMany'));
    return ok(undefined);
}

/** Every plan item, most urgent first. */
export async function listByUser(
    supabase: Client,
    userId: string,
): Promise<Result<PlanItem[], AppError>> {
    const { data, error } = await supabase
        .from('recommendation_plans')
        .select('*, skill_categories(name)')
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .order('recommendation_id', { ascending: true });

    if (error) return err(fromPostgrestError(error, 'recommendation_plans.listByUser'));

    return ok(data.map((row) => toPlanItem(row, row.skill_categories?.name ?? 'Unknown category')));
}

/**
 * One item, if it belongs to this member.
 *
 * The `user_id` clause is the ownership check. Without RLS, dropping that line
 * would let anybody tick off anybody's plan item by guessing an id.
 */
export async function findById(
    supabase: Client,
    userId: string,
    recommendationId: number,
): Promise<Result<PlanItem | null, AppError>> {
    const { data, error } = await supabase
        .from('recommendation_plans')
        .select('*, skill_categories(name)')
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'recommendation_plans.findById'));
    if (!data) return ok(null);

    return ok(toPlanItem(data, data.skill_categories?.name ?? 'Unknown category'));
}

/**
 * Move an item's status.
 *
 * `completed_at` is maintained by the BEFORE trigger in 0002 and the XP award
 * by the AFTER trigger, so this sends one column and the database does the
 * rest. Un-ticking and re-ticking does not pay twice — `xp_events_plan_item_once`
 * sees to that.
 */
export async function setStatus(
    supabase: Client,
    userId: string,
    recommendationId: number,
    status: PlanStatus,
): Promise<Result<void, AppError>> {
    const { error } = await supabase
        .from('recommendation_plans')
        .update({ progress_status: status })
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

    if (error) return err(fromPostgrestError(error, 'recommendation_plans.setStatus'));
    return ok(undefined);
}
