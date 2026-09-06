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
 * What this service adds AFTER the grade is the plan: missed questions in,
 * recommendation_plans rows out, via the pure builders in lib/domain. Every
 * paper gets one now, the baseline and every category run alike (SP-060); the
 * only difference is the sentence naming the run. Rules decide, AI decorates (D5) — and since SP-091
 * the decoration is real: ai.service.enhancePlan writes `ai_description` onto
 * those same rows once they exist. It runs after the insert, never instead of
 * it, so a provider that is off, slow or wrong costs the member some prose and
 * never a plan.
 *
 * D5 NOW HAS A SECOND CASE, and it is worth being honest about where the line
 * moved. The rules can only build a plan out of questions that carry a
 * `topic_title` and a `study_advice`, and most of the bank carries neither —
 * those columns arrived long after the questions did. For those runs "rules
 * decide" decided nothing, and a member got a graded score, AI feedback, and an
 * empty plan. So when the rules produce NO rows at all, ai.service.draftPlan is
 * asked to write them from the missed questions themselves. Rules still win
 * wherever they have anything to say; the model only fills a silence.
 *
 * Test: tests/lib/services/grading.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as categoryRepo from '../repositories/category.repo';
import * as responseRepo from '../repositories/response.repo';
import * as planRepo from '../repositories/plan.repo';
import * as profileRepo from '../repositories/profile.repo';
import { bandBreakdown, buildBaselineRecommendations, type BandScore } from '../domain/baseline';
import { buildCategoryRecommendations, categoryRunLabel } from '../domain/recommendations';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../domain/constants';
import { estimateLevel } from '../domain/levels';
import { appError, type AppError } from '../errors';
import { err, ok, unwrapOr, type Result } from '../result';
import type { PlanItem, ReviewItem, SkillLevel } from '../domain/types';
import { draftPlan, enhancePlan } from './ai.service';

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
    {
        const categoryId = assessment.value.category_id;
        const isBaseline = categoryId === GENERAL_KNOWLEDGE_CATEGORY_ID;

        const review = await responseRepo.listForReview(supabase, assessmentId);

        if (review.ok) {
            // `text` is here for the drafting fallback below and is ignored by
            // the rule builders, which take a MissedQuestion and read three
            // fields off it. A model that has to name the topic itself has
            // nothing else to name it from.
            const missed = review.value
                .filter((item) => !item.isCorrect)
                .map((item) => ({
                    text: item.text,
                    difficulty: item.difficulty,
                    topicTitle: item.topicTitle,
                    studyAdvice: item.studyAdvice,
                }));

            // THE CATEGORY GATE IS GONE (SP-060). This used to run for the
            // baseline alone, and the reason was never that a category run
            // deserved no plan — it was that category questions carried no
            // `topic_title`, so there was nothing to recommend. The admin form
            // collects the topic and the advice now, and a question that still
            // has neither is skipped by the builder rather than by an `if` up
            // here: a half-annotated bank produces a shorter plan, not no plan.
            //
            // The name is read only for the sentence, and only off the baseline
            // path. A failed read costs a phrase, never the plan — which is why
            // it degrades to null instead of returning.
            const category = isBaseline ? null : await categoryRepo.findById(supabase, categoryId);
            const categoryName = category?.ok ? category.value.name : null;
            const runLabel = isBaseline ? 'baseline assessment' : categoryRunLabel(categoryName);

            const ruleBased = isBaseline
                ? buildBaselineRecommendations(missed)
                : buildCategoryRecommendations(missed, categoryName);

            // Read once, for whichever of the two AI calls below runs. It used
            // to be read inside the enhancement branch, which was the only one
            // there was; both need it, and neither is worth a second query.
            // A failure costs a greeting, never a plan: `unwrapOr` on purpose.
            const firstName =
                missed.length > 0
                    ? unwrapOr(await profileRepo.findByUserId(supabase, userId), null)?.firstName
                    : undefined;

            // THE FALLBACK, AND WHAT IT IS A FALLBACK FOR. `ruleBased` is empty
            // whenever the questions this member missed carry no topic and no
            // advice — which is not an edge case but most of the bank, since
            // those columns arrived after it did. Until now that produced an
            // empty plan page after a graded run, and the AI half looked broken
            // when it had simply never been given a row to touch.
            //
            // So: rules first, ALWAYS, because they are deterministic, free and
            // written by a human who knows the material. Only when they produce
            // nothing does the model get asked to write the plan itself, out of
            // the questions alone. An annotated bank never reaches this line,
            // and a plan therefore never gets worse because a provider is
            // having a bad day.
            const drafted =
                ruleBased.length === 0 && missed.length > 0
                    ? await draftPlan(userId, {
                          score: graded.value,
                          runLabel,
                          firstName,
                          missed: missed.map((item) => ({
                              text: item.text,
                              difficulty: item.difficulty,
                          })),
                      })
                    : [];

            const recommendations = ruleBased.length > 0 ? ruleBased : drafted;

            const inserted = await planRepo.insertMany(
                supabase,
                userId,
                categoryId,
                assessmentId,
                recommendations,
            );

            if (!inserted.ok) {
                console.error('[grading] plan not written:', inserted.error.message);
            } else if (ruleBased.length > 0) {
                // SP-091. Only once the rows are actually there — there is
                // nothing to decorate otherwise, and the whole point of D5 is
                // that this half is optional.
                //
                // RULE-BUILT ROWS ONLY, which is why the condition is
                // `ruleBased` and not `recommendations`. A drafted plan already
                // carries the model's paragraph in `ai_description`; sending it
                // back for enhancement would ask a model to elaborate its own
                // prose, spend a second call to do it, and overwrite a good
                // paragraph with a worse one about a topic it invented.
                //
                // The .catch() is not redundant with enhancePlan's own: that
                // function is DOCUMENTED never to throw, and this line is what
                // makes the promise this file cares about — a graded, paid-for
                // run never becomes an error page — independent of whether
                // somebody keeps it. It costs one line.
                await enhancePlan(userId, {
                    assessmentId,
                    score: graded.value,
                    firstName,
                    topics: ruleBased.map((item) => ({
                        topicTitle: item.topicTitle,
                        ruleDescription: item.description,
                    })),
                }).catch((error) => {
                    console.error('[grading] plan enhancement threw:', error);
                });
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
    /**
     * The stored AI feedback, or null if none was ever generated (SP-093).
     * Carried here rather than read again by ai.service: this row is already
     * loaded, and a second query for one column is a round trip for nothing.
     */
    aiFeedback: string | null;
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
        aiFeedback: row.ai_feedback,
    });
}
