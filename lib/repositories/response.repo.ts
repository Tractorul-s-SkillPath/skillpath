/**
 * student_responses table.
 *
 * Layer: REPOSITORY
 * Stories: SP-043, SP-044, SP-046, SP-053
 *
 * TWO READS, TWO SHAPES, ONE RULE. `listForRun` serves the in-progress screen
 * and selects the answer columns BY NAME — answer_id, answer_text, position —
 * so `is_correct` never enters the payload, the RSC stream or the network tab
 * (SP-038). `listForReview` embeds the full answers row, key included, and only
 * grading.service hands it out, only for a submitted run. Do not "simplify"
 * the two into one select.
 *
 * Ordering by position is not cosmetic: it is what makes a refresh reproduce
 * the same paper (SP-044).
 *
 * Test: tests/lib/repositories/response.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SkillLevel } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { ReviewItem, RunQuestion } from '../domain/types';

type Client = SupabaseClient<Database>;

/**
 * The paper, in order, with the member's current selections. Options sorted by
 * their own position for the same reason toAdminQuestion sorts them: without an
 * order, the planner may shuffle A/B/C/D on a plain refresh.
 */
export async function listForRun(
    supabase: Client,
    assessmentId: number,
): Promise<Result<RunQuestion[], AppError>> {
    const { data, error } = await supabase
        .from('student_responses')
        .select(
            'position, selected_answer_id, questions(question_id, text, answers(answer_id, answer_text, position))',
        )
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true });

    if (error) return err(fromPostgrestError(error, 'student_responses.listForRun'));

    return ok(
        data.map((row) => ({
            questionId: row.questions?.question_id ?? 0,
            position: row.position,
            text: row.questions?.text ?? '',
            options: [...(row.questions?.answers ?? [])]
                .sort((a, b) => a.position - b.position)
                .map((a) => ({ answerId: a.answer_id, text: a.answer_text })),
            selectedAnswerId: row.selected_answer_id,
        })),
    );
}

/**
 * The graded paper, correct answers included. Callers must have checked
 * status = 'submitted' first — this shape is what SP-053 says may exist only
 * after grading.
 */
export async function listForReview(
    supabase: Client,
    assessmentId: number,
): Promise<Result<ReviewItem[], AppError>> {
    const { data, error } = await supabase
        .from('student_responses')
        .select(
            'position, selected_answer_id, is_correct, questions(question_id, text, difficulty, topic_title, study_advice, answers(answer_id, answer_text, is_correct, position))',
        )
        .eq('assessment_id', assessmentId)
        .order('position', { ascending: true });

    if (error) return err(fromPostgrestError(error, 'student_responses.listForReview'));

    return ok(
        data.map((row) => {
            const answers = [...(row.questions?.answers ?? [])].sort(
                (a, b) => a.position - b.position,
            );

            return {
                position: row.position,
                text: row.questions?.text ?? '',
                difficulty: (row.questions?.difficulty ?? 'beginner') as SkillLevel,
                options: answers.map((a) => ({ answerId: a.answer_id, text: a.answer_text })),
                selectedAnswerId: row.selected_answer_id,
                correctAnswerId: answers.find((a) => a.is_correct)?.answer_id ?? null,
                // The D4 snapshot, not recomputed: what the member was told.
                isCorrect: row.is_correct === true,
                topicTitle: row.questions?.topic_title ?? null,
                studyAdvice: row.questions?.study_advice ?? null,
            };
        }),
    );
}

/**
 * Record a selection. Scoped by assessment AND question, so the row is the
 * pre-created one from SP-041 — this never inserts, because the set of
 * questions on a paper is fixed the moment the run starts.
 *
 * Ownership is the SERVICE's check (it loads the assessment by user first);
 * with no RLS underneath, this function trusts its caller the way every other
 * repository write here does.
 */
export async function saveSelection(
    supabase: Client,
    assessmentId: number,
    questionId: number,
    answerId: number,
): Promise<Result<void, AppError>> {
    const { error } = await supabase
        .from('student_responses')
        .update({
            selected_answer_id: answerId,
            answered_at: new Date().toISOString(),
        })
        .eq('assessment_id', assessmentId)
        .eq('question_id', questionId);

    if (error) return err(fromPostgrestError(error, 'student_responses.saveSelection'));
    return ok(undefined);
}
