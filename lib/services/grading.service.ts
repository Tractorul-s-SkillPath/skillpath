/**
 * Submission and grading.
 *
 * Layer: SERVICE
 * Stories: SP-046, SP-115, SP-116, SP-117
 *
 * THE SCORE IS NOT COMPUTED HERE. submit() takes no score and could not write
 * one if it did — grading is grade_assessment() in the database, which scores
 * the responses, writes the is_correct snapshots (D4), sets status and
 * total_score, upserts category_progress and awards XP, all in one call. A
 * crashed request cannot leave a member scored but unpaid, and a forged score
 * cannot be expressed as an argument (SP-055).
 *
 * What this service adds AFTER the grade is the baseline plan: wrong paper
 * positions in, recommendation_plans rows out, via the pure map in
 * lib/domain/baseline.ts. Rules decide, AI decorates later (D5).
 *
 * Test: tests/lib/services/grading.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as categoryRepo from '../repositories/category.repo';
import * as responseRepo from '../repositories/response.repo';
import * as planRepo from '../repositories/plan.repo';
import { bandBreakdown, buildBaselineRecommendations, type BandScore } from '../domain/baseline';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../domain/constants';
import { estimateLevel } from '../domain/levels';
import { appError, type AppError } from '../errors';
import { err, ok, unwrapOr, type Result } from '../result';
import type { PlanItem, ReviewItem, SkillLevel } from '../domain/types';

/**
 * Submit an in-progress run (SP-046, SP-115).
 *
 * Unanswered questions are submitted as they stand — the confirm dialog is the
 * page's job, the database counts them as wrong. Resubmission is 'conflict',
 * not a second grade: status is checked before the RPC, and the RPC itself
 * refuses a run that is no longer in_progress.
 */
export async function submit(
    userId: number,
    assessmentId: number,
): Promise<Result<{ score: number }, AppError>> {
    const supabase = await createClient();

    const assessment = await assessmentRepo.findOwn(supabase, userId, assessmentId);
    if (!assessment.ok) return err(assessment.error);
    if (!assessment.value) return err(appError('not_found', 'Not found.'));

    if (assessment.value.status !== 'in_progress') {
        return err(appError('conflict', 'This assessment has already been submitted.'));
    }

    const graded = await assessmentRepo.grade(supabase, assessmentId);
    if (!graded.ok) return err(graded.error);

    // The baseline's plan. Wrong OR unanswered — is_correct is false for both
    // after grading, and a skipped question is as much a gap as a missed one.
    // A failure here must not eat the score: the run is graded and paid by now,
    // so the plan degrades to empty rather than turning success into an error.
    if (assessment.value.category_id === GENERAL_KNOWLEDGE_CATEGORY_ID) {
        const review = await responseRepo.listForReview(supabase, assessmentId);

        if (review.ok) {
            const missed = review.value
                .filter((item) => !item.isCorrect)
                .map((item) => ({
                    difficulty: item.difficulty,
                    topicTitle: item.topicTitle,
                    studyAdvice: item.studyAdvice,
                }));

            const inserted = await planRepo.insertMany(
                supabase,
                userId,
                GENERAL_KNOWLEDGE_CATEGORY_ID,
                assessmentId,
                buildBaselineRecommendations(missed),
            );

            if (!inserted.ok) {
                console.error('[grading] baseline plan not written:', inserted.error.message);
            }
        }
    }

    return ok({ score: graded.value });
}

/** Everything the results page renders, in one shape. */
export interface AssessmentResults {
    assessmentId: number;
    categoryId: number;
    /** For the headline. The baseline keeps its own copy; runs name their category. */
    categoryName: string;
    score: number;
    level: SkillLevel;
    submittedAt: string | null;
    bands: BandScore[];
    review: ReviewItem[];
    /** The plan rows THIS run generated, most urgent first. */
    recommendations: PlanItem[];
}

/**
 * The results read (SP-116). Submitted runs only: an in-progress id gets
 * 'conflict' so the page can bounce back into the run, and somebody else's id
 * gets the same not_found a nonexistent one does (SP-053 AC2).
 */
export async function getResults(
    userId: number,
    assessmentId: number,
): Promise<Result<AssessmentResults, AppError>> {
    const supabase = await createClient();

    const assessment = await assessmentRepo.findOwn(supabase, userId, assessmentId);
    if (!assessment.ok) return err(assessment.error);
    if (!assessment.value) return err(appError('not_found', 'Not found.'));

    const row = assessment.value;
    if (row.status !== 'submitted') {
        return err(appError('conflict', 'This assessment has not been submitted yet.'));
    }

    const review = await responseRepo.listForReview(supabase, assessmentId);
    if (!review.ok) return err(review.error);

    const score = Number(row.total_score ?? 0);

    // PlanItem does not carry assessment_id, and for the baseline it does not
    // need to: one attempt means every plan row in this category came from this
    // run. Revisit when retakes or per-category runs write into the same list.
    const plan = unwrapOr(await planRepo.listByUser(supabase, userId), []);

    // Headline material only, so a failed read degrades to a wrong-ish title
    // rather than a lost results page.
    const category = await categoryRepo.findById(supabase, row.category_id);
    const categoryName = category.ok ? category.value.name : 'Assessment';

    return ok({
        assessmentId: row.assessment_id,
        categoryId: row.category_id,
        categoryName,
        score,
        level: estimateLevel(score),
        submittedAt: row.submitted_at,
        bands: bandBreakdown(review.value),
        review: review.value,
        recommendations: plan.filter((item) => item.categoryId === row.category_id),
    });
}
