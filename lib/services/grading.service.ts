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
 * positions in, ai_study_plans rows out.
 *
 * Test: tests/lib/services/grading.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as categoryRepo from '../repositories/category.repo';
import * as responseRepo from '../repositories/response.repo';
import { bandBreakdown, type BandScore } from '../domain/baseline';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../domain/constants';
import { estimateLevel } from '../domain/levels';
import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { ReviewItem, SkillLevel } from '../domain/types';
import { generateAndSaveStudyPlan } from './ai.service';

/**
 * Submit an in-progress run (SP-046, SP-115).
 *
 * Unanswered questions are submitted as they stand — the confirm dialog is the
 * page's job, the database counts them as wrong. Resubmission is 'conflict',
 * not a second grade: status is checked before the RPC, and the RPC itself
 * refuses a run that is no longer in_progress.
 */
export async function submit(
    userId: string,
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
                    topicTitle: item.topicTitle,
                    studyAdvice: item.studyAdvice,
                }));

            const aiPlan = await generateAndSaveStudyPlan(userId, assessmentId, missed);

            if (aiPlan.ok) {
                const itemsToInsert = aiPlan.value.recommendations.map((rec: any, index: number) => {
                    const actionText = rec.actionItems.map((a: string) => `• ${a}`).join('\n');
                    return {
                        topicTitle: rec.title,
                        description: rec.rationale,
                        priority: index + 1,
                        aiDescription: `⏱️ Timp estimat: ~${rec.estimatedMinutes} minute\n\nPași de acțiune:\n${actionText}`
                    };
                });

                await planRepo.insertMany(supabase, userId, GENERAL_KNOWLEDGE_CATEGORY_ID, assessmentId, itemsToInsert);
            }
        }
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
    /** The AI generated plan. */
    aiPlan: any;
}

/**
 * The results read (SP-116). Submitted runs only: an in-progress id gets
 * 'conflict' so the page can bounce back into the run, and somebody else's id
 * gets the same not_found a nonexistent one does (SP-053 AC2).
 */
export async function getResults(
    userId: string,
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

    const { data: aiPlanData } = await supabase
        .from('ai_study_plans')
        .select('plan_data')
        .eq('user_id', userId)
        .eq('assessment_id', assessmentId)
        .maybeSingle();

    const aiPlan = aiPlanData?.plan_data || null;

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
        aiPlan,
    });
}