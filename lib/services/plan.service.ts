/**
 * Learning plan.
 *
 * Layer: SERVICE
 * Stories: SP-061, SP-062, SP-063, SP-065
 *
 * The read and the one write the plan page needs. Generation is NOT here — the
 * baseline's plan is written by grading.service on submit, and the generic
 * per-category generator (SP-060/SP-065) still is not: category runs produce a
 * score and no plan rows, because their questions carry no topic_title yet.
 *
 * Test: tests/lib/services/plan.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as planRepo from '../repositories/plan.repo';
import { appError, type AppError } from '../errors';
import { err, type Result } from '../result';
import type { PlanItem, PlanStatus } from '../domain/types';

/** Every plan item the member has, most urgent first. Grouping is the page's job. */
export async function getPlan(userId: number): Promise<Result<PlanItem[], AppError>> {
    const supabase = await createClient();
    return planRepo.listByUser(supabase, userId);
}

/**
 * Move a plan item's status.
 *
 * The XP award is the database's job (0002_functions.sql), so this does not
 * touch XP: it checks ownership, writes one column, and the trigger pays out
 * exactly once however many times an item is ticked and un-ticked.
 */
export async function setItemStatus(
    userId: number,
    recommendationId: number,
    status: PlanStatus,
): Promise<Result<void, AppError>> {
    const supabase = await createClient();

    // Ownership check. With no RLS, skipping this would let anybody tick off
    // anybody's plan item by guessing an id.
    const existing = await planRepo.findById(supabase, userId, recommendationId);

    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(appError('not_found', 'That plan item is not yours.'));

    return planRepo.setStatus(supabase, userId, recommendationId, status);
}
