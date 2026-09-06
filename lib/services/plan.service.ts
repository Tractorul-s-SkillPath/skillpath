import 'server-only';
import { createClient } from '../supabase/server';
import * as planRepo from '../repositories/plan.repo';
import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { PlanItem, PlanStatus } from '../domain/types';

export async function getPlan(userId: string): Promise<Result<PlanItem[], AppError>> {
    const supabase = await createClient();
    return planRepo.listByUser(supabase, userId);
}

export async function setItemStatus(
    userId: string,
    recommendationId: number,
    status: PlanStatus,
): Promise<Result<void, AppError>> {
    const supabase = await createClient();
    const existing = await planRepo.findById(supabase, userId, recommendationId);

    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(appError('not_found', 'That plan item is not yours.'));

    return planRepo.setStatus(supabase, userId, recommendationId, status);
}

export async function getPlanExplanation(userId: string): Promise<Result<string | null, AppError>> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('ai_study_plans')
        .select('plan_data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) return err(appError('database_error', error.message));
    return ok(data?.plan_data?.explanation || null);
}