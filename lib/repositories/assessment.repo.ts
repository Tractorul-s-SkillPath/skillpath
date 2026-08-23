/**
 * assessments table.
 *
 * Layer: REPOSITORY
 * Stories: SP-020, SP-040, SP-050
 *
 * NOTE FOR THE ASSESSMENT SLICE: only the reads the profile page needs are
 * implemented here — a member's history. Creating a run, saving an answer and
 * submitting belong to that slice; add them here rather than querying
 * `assessments` from anywhere else.
 *
 * Grading is not a repository method and must not become one. It is
 * `grade_assessment()` in 0002_functions.sql, called by RPC, because the answer
 * key must never leave the database.
 *
 * Test: tests/lib/repositories/assessment.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { AssessmentSummary } from '../domain/types';
import { toAssessment } from './mappers';

type Client = SupabaseClient<Database>;

/**
 * A member's assessment history, newest first.
 *
 * The default limit is the page size the profile history section renders. It is
 * a parameter rather than a constant because the dashboard will want a
 * different one — but it is never unbounded.
 */
export async function listByUser(
    supabase: Client,
    userId: number,
    limit = 20,
): Promise<Result<AssessmentSummary[], AppError>> {
    const { data, error } = await supabase
        .from('assessments')
        .select('*, skill_categories(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) return err(fromPostgrestError(error, 'assessments.listByUser'));

    return ok(data.map((row) => toAssessment(row, row.skill_categories?.name ?? 'Unknown category')));
}

/**
 * Grade an assessment and return the percentage.
 *
 * A thin wrapper over the SQL function, on purpose: the score, the per-response
 * verdicts, the XP award and the category_progress update all happen inside one
 * database call, so a crashed request cannot leave a member scored but unpaid.
 */
export async function grade(
    supabase: Client,
    assessmentId: number,
): Promise<Result<number, AppError>> {
    const { data, error } = await supabase.rpc('grade_assessment', {
        p_assessment_id: assessmentId,
    });

    if (error) return err(fromPostgrestError(error, 'assessments.grade'));
    return ok(Number(data));
}
