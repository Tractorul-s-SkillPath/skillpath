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
    /**
     * Only ever set by `ai.service.draftPlan`, whose rows arrive with their
     * paragraph already written — the model authored the topic, so there is no
     * second pass to decorate it with. A rule-built row leaves this undefined
     * and is decorated afterwards, which is still the ordinary path.
     */
    aiDescription?: string;
}

/**
 * Write a freshly generated plan, one statement.
 *
 * `progress_status` and `completed_at` are left to their defaults — a new item
 * is `not_started` by definition. `assessment_id` records which run produced
 * the advice (SP-065's "latest assessment wins" needs to know).
 *
 * AN UPSERT, NOT AN INSERT, SINCE SP-060. The baseline is one attempt, so every
 * row it wrote was new; a category run may be retaken, and
 * `recommendation_plans_topic_unique (user_id, category_id, topic_title)` makes
 * the second run's overlapping topics a constraint violation. That failure
 * would arrive in a path that logs and swallows — a member retakes an
 * assessment and their plan silently stops updating.
 *
 * WHAT A CONFLICT UPDATES, AND WHAT IT DELIBERATELY DOES NOT. The advice, the
 * priority and the run it came from are rewritten, because the newest run is
 * the one that knows. `progress_status` and `completed_at` are not in the
 * payload at all, so an item a member already finished stays finished and the
 * XP the trigger paid for it is not re-paid. `ai_description` IS cleared: it
 * was written about the previous run's rule text, and ai.service re-decorates
 * these rows moments later — a stale paragraph under fresh advice is worse than
 * no paragraph.
 *
 * THIS IS NOT SP-065. A topic the member has stopped missing keeps its row,
 * with its old `assessment_id`; supersession — deciding when an item from an
 * earlier run should disappear — is still that story's to write. This only
 * makes a retake update rather than fail.
 */
export async function insertMany(
    supabase: Client,
    userId: string,
    categoryId: number,
    assessmentId: number,
    items: NewPlanItem[],
): Promise<Result<void, AppError>> {
    if (items.length === 0) return ok(undefined);

    const { error } = await supabase.from('recommendation_plans').upsert(
        items.map((item) => ({
            user_id: userId,
            category_id: categoryId,
            assessment_id: assessmentId,
            topic_title: item.topicTitle,
            rule_description: item.description,
            // Null for a rule-built row, which is what makes the conflict case
            // CLEAR a stale paragraph written about the previous run's advice.
            // A drafted row supplies its own, so the same statement covers both
            // and neither leaves the column describing text that is gone.
            ai_description: item.aiDescription ?? null,
            priority: item.priority,
        })),
        { onConflict: 'user_id,category_id,topic_title' },
    );

    if (error) return err(fromPostgrestError(error, 'recommendation_plans.insertMany'));
    return ok(undefined);
}

/**
 * Add the AI elaboration to rows that already exist (SP-091).
 *
 * A SECOND statement, deliberately, rather than an `ai_description` on
 * insertMany. D5 splits the columns so the plan renders correctly with AI
 * disabled or failing, and folding the AI text into the insert would undo
 * that: a slow or broken provider would delay or lose the rule-based rows
 * themselves, which are the half that has to survive. Insert the rules, then
 * decorate — this only ever ADDS.
 *
 * Matched on `topic_title` within one run, which the
 * `recommendation_plans_topic_unique (user_id, category_id, topic_title)`
 * constraint makes a key rather than a guess. One statement per item: there
 * are at most twenty, this happens once per run, and PostgREST has no way to
 * send twenty different values for one column in a single update that does not
 * also rewrite every other column on the row.
 *
 * Returns how many rows were decorated. A failure is reported, not thrown —
 * the caller logs it and leaves the plan as it is.
 */
export async function setAiDescriptions(
    supabase: Client,
    userId: string,
    assessmentId: number,
    items: Array<{ topicTitle: string; aiDescription: string }>,
): Promise<Result<number, AppError>> {
    if (items.length === 0) return ok(0);

    const results = await Promise.all(
        items.map((item) =>
            supabase
                .from('recommendation_plans')
                .update({ ai_description: item.aiDescription }, { count: 'exact' })
                .eq('user_id', userId)
                .eq('assessment_id', assessmentId)
                .eq('topic_title', item.topicTitle),
        ),
    );

    const failure = results.find((result) => result.error)?.error;
    if (failure) return err(fromPostgrestError(failure, 'recommendation_plans.setAiDescriptions'));

    // ROWS TOUCHED, NOT STATEMENTS SENT. This returned `items.length`, which is
    // the number of updates ATTEMPTED — a title matching no row reported itself
    // as a decorated row, and the caller logged a number it had not achieved.
    // `count: 'exact'` makes PostgREST report what it actually matched, which
    // is the only version of this number worth returning.
    return ok(results.reduce((total, result) => total + (result.count ?? 0), 0));
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
