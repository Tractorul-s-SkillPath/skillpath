/**
 * assessments table.
 *
 * Layer: REPOSITORY
 * Stories: SP-020, SP-040, SP-050
 *
 * The run lifecycle lives here now too: find-or-create for the baseline,
 * ownership-scoped reads, and the grade RPC. Saving an answer is
 * response.repo.ts's business — it writes `student_responses`, not this table.
 *
 * Grading is not a repository method and must not become one. It is
 * `grade_assessment()` in 0002_functions.sql, called by RPC, because the answer
 * key must never leave the database.
 *
 * Test: tests/lib/repositories/assessment.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssessmentRow, Database } from '../supabase/database.types';
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
 * The member's newest assessment in one category with the given status, or
 * null. One query serves both "resume my in-progress run" (SP-042) and "has
 * the baseline already been submitted" (the one-attempt rule).
 */
export async function findByStatus(
    supabase: Client,
    userId: number,
    categoryId: number,
    status: 'in_progress' | 'submitted',
): Promise<Result<AssessmentRow | null, AppError>> {
    const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .eq('status', status)
        .order('assessment_id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'assessments.findByStatus'));
    return ok(data);
}

/**
 * Every category the member has an open run in, with the run's id.
 *
 * One query for the whole assessments page, instead of a findByStatus per
 * category. At most one row per category — the partial unique index
 * `one_active_assessment_per_user_category` is the guarantee — so a Map from
 * category to run id is a faithful shape, not a last-write-wins accident.
 */
export async function listInProgress(
    supabase: Client,
    userId: number,
): Promise<Result<Map<number, number>, AppError>> {
    const { data, error } = await supabase
        .from('assessments')
        .select('assessment_id, category_id')
        .eq('user_id', userId)
        .eq('status', 'in_progress');

    if (error) return err(fromPostgrestError(error, 'assessments.listInProgress'));

    return ok(new Map(data.map((row) => [row.category_id, row.assessment_id])));
}

/** One run, only if it belongs to this member. The `user_id` clause IS the 404. */
export async function findOwn(
    supabase: Client,
    userId: number,
    assessmentId: number,
): Promise<Result<AssessmentRow | null, AppError>> {
    const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) return err(fromPostgrestError(error, 'assessments.findOwn'));
    return ok(data);
}

/**
 * An assessment plus its pre-created response rows, together (SP-041 / D2).
 *
 * PostgREST gives us no transaction across two requests, so this follows the
 * pattern question.repo.insertWithAnswers documents: insert the parent, insert
 * the children, and delete the parent if the children fail — an in-progress
 * assessment with no response rows is a run that renders as a blank paper.
 * The proper fix is one SECURITY DEFINER function; this is the honest version
 * until that migration exists.
 *
 * `started_at` is set here, at creation — the clock starts when the paper is
 * handed out, and remainingSeconds() is measured from this value on both sides.
 */
export async function createWithResponses(
    supabase: Client,
    input: {
        userId: number;
        categoryId: number;
        requestedLevel: 'beginner' | 'intermediate' | 'advanced';
        timeLimitSeconds: number;
        questionIds: number[];
    },
): Promise<Result<number, AppError>> {
    const { data, error } = await supabase
        .from('assessments')
        .insert({
            user_id: input.userId,
            category_id: input.categoryId,
            requested_level: input.requestedLevel,
            time_limit_seconds: input.timeLimitSeconds,
            started_at: new Date().toISOString(),
        })
        .select('assessment_id')
        .single();

    if (error) return err(fromPostgrestError(error, 'assessments.create'));

    const assessmentId = data.assessment_id;

    const { error: responsesError } = await supabase.from('student_responses').insert(
        input.questionIds.map((questionId, index) => ({
            assessment_id: assessmentId,
            question_id: questionId,
            // Explicitly null: the pre-created row IS the unanswered state (D2).
            selected_answer_id: null,
            // 1-based: "question 3 of 20" is how a member counts, and
            // lib/domain/baseline.ts keys its topic map the same way.
            position: index + 1,
        })),
    );

    if (responsesError) {
        const { error: rollbackError } = await supabase
            .from('assessments')
            .delete()
            .eq('assessment_id', assessmentId);

        if (rollbackError) {
            console.error(
                '[db] assessments.createWithResponses: could not remove assessment',
                assessmentId,
                'after its responses failed:',
                rollbackError.message,
            );
        }

        return err(fromPostgrestError(responsesError, 'student_responses.insert'));
    }

    return ok(assessmentId);
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
