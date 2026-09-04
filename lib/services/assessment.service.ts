/**
 * Assessment lifecycle — the baseline run and category runs.
 *
 * Layer: SERVICE
 * Stories: SP-040, SP-041, SP-042, SP-043, SP-044, SP-112, SP-113
 *
 * Two ways in, one lifecycle. The baseline is pinned to
 * GENERAL_KNOWLEDGE_CATEGORY_ID, one attempt, the fixed 20 in seed order — the
 * same paper for everybody, by team decision. Category runs draw a shuffled
 * paper from the category's active bank and may be retaken: the newer score
 * simply overwrites `category_progress`, which is the point of a retake.
 * Everything after the start — saving, the clock, grading — is shared.
 *
 * Test: tests/lib/services/assessment.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as categoryRepo from '../repositories/category.repo';
import * as profileRepo from '../repositories/profile.repo';
import * as questionRepo from '../repositories/question.repo';
import * as responseRepo from '../repositories/response.repo';
import {
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
    CATEGORY_PAPER_SIZE,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
    MIN_CATEGORY_QUESTIONS,
    SECONDS_PER_QUESTION,
    TIMER_GRACE_SECONDS,
} from '../domain/constants';
import { drawPaper } from '../domain/paper';
import { retakeRecommended } from '../domain/recommendations';
import { hasExpired } from '../domain/timer';
import { appError, type AppError } from '../errors';
import { err, ok, unwrapOr, type Result } from '../result';
import type { AssessmentRun, SkillLevel } from '../domain/types';

/** Where startBaseline wants the member sent. The action just follows it. */
export type BaselineStart =
    { kind: 'run'; assessmentId: number } | { kind: 'results'; assessmentId: number };

/**
 * Find or create the member's baseline run (SP-112).
 *
 * Order matters: submitted first — the attempt is spent and the only place to
 * go is the results. Then in-progress — closing the tab mid-run resumes, it
 * does not restart (SP-042: the check is the first line of defence, the
 * partial unique index would be the backstop once it exists). Only then create.
 */
export async function startBaseline(userId: string): Promise<Result<BaselineStart, AppError>> {
    const supabase = await createClient();

    const submitted = await assessmentRepo.findByStatus(
        supabase,
        userId,
        GENERAL_KNOWLEDGE_CATEGORY_ID,
        'submitted',
    );
    if (!submitted.ok) return err(submitted.error);
    if (submitted.value) {
        return ok({ kind: 'results', assessmentId: submitted.value.assessment_id });
    }

    const inProgress = await assessmentRepo.findByStatus(
        supabase,
        userId,
        GENERAL_KNOWLEDGE_CATEGORY_ID,
        'in_progress',
    );
    if (!inProgress.ok) return err(inProgress.error);
    if (inProgress.value) {
        return ok({ kind: 'run', assessmentId: inProgress.value.assessment_id });
    }

    // The fixed paper: seed order IS paper order (ascending question_id — the
    // seed inserts beginner -> advanced, so the run ramps up).
    const questions = await questionRepo.listActiveIds(supabase, GENERAL_KNOWLEDGE_CATEGORY_ID);
    if (!questions.ok) return err(questions.error);

    // A short paper places people wrongly, which is worse than refusing
    // (SP-111 AC3). The dashboard card checks this too; this is the backstop.
    if (questions.value.length < BASELINE_QUESTION_COUNT) {
        return err(
            appError(
                'unavailable',
                'The baseline assessment is not fully set up yet. Try again later.',
            ),
        );
    }

    const created = await assessmentRepo.createWithResponses(supabase, {
        userId,
        categoryId: GENERAL_KNOWLEDGE_CATEGORY_ID,
        // The paper mixes all three; the column is NOT NULL, so it records
        // where the ramp starts rather than a level anybody chose.
        requestedLevel: 'beginner',
        timeLimitSeconds: BASELINE_TIME_LIMIT_SECONDS,
        questionIds: questions.value.slice(0, BASELINE_QUESTION_COUNT),
    });
    if (!created.ok) return err(created.error);

    return ok({ kind: 'run', assessmentId: created.value });
}

/**
 * Find or create a category run (SP-040, SP-042).
 *
 * The order mirrors startBaseline minus the submitted check — a submitted
 * category run does not spend anything, retaking is allowed and expected. An
 * open run resumes rather than restarts; the partial unique index
 * `one_active_assessment_per_user_category` backstops the race two tabs can
 * produce between the check and the insert.
 */
export async function startCategory(
    userId: string,
    categoryId: number,
): Promise<Result<number, AppError>> {
    const supabase = await createClient();

    // Re-checked at the write even though the page only offers startable
    // categories: a Server Action is a public endpoint, and "the page would
    // not have shown the button" means nothing to somebody with curl.
    const category = await categoryRepo.findStartable(supabase, categoryId);
    if (!category.ok) return err(category.error);
    if (!category.value) {
        return err(appError('not_found', 'That assessment is not available.'));
    }

    const inProgress = await assessmentRepo.findByStatus(
        supabase,
        userId,
        categoryId,
        'in_progress',
    );
    if (!inProgress.ok) return err(inProgress.error);
    if (inProgress.value) return ok(inProgress.value.assessment_id);

    const bank = await questionRepo.listActiveIds(supabase, categoryId);
    if (!bank.ok) return err(bank.error);

    if (bank.value.length < MIN_CATEGORY_QUESTIONS) {
        return err(
            appError(
                'unavailable',
                'This category does not have enough questions yet. Try another.',
            ),
        );
    }

    const paper = drawPaper(bank.value, CATEGORY_PAPER_SIZE);

    // The member's recorded level, if they follow the category — the column is
    // NOT NULL and "the level the run was pitched at" is the honest value.
    // Nobody picks a level by hand; the last graded run sets it.
    const interests = await profileRepo.listInterests(supabase, userId);
    const level: SkillLevel =
        unwrapOr(interests, []).find((interest) => interest.categoryId === categoryId)?.level ??
        'beginner';

    return assessmentRepo.createWithResponses(supabase, {
        userId,
        categoryId,
        requestedLevel: level,
        timeLimitSeconds: paper.length * SECONDS_PER_QUESTION,
        questionIds: paper,
    });
}

/** The baseline as the assessments page presents it: one attempt, three states. */
export interface BaselineStatus {
    state: 'not_started' | 'in_progress' | 'submitted';
    /** The run to resume, or the results to revisit. Null before any attempt. */
    assessmentId: number | null;
}

/** One category questionnaire as the assessments page lists it. */
export interface AssessmentOption {
    categoryId: number;
    name: string;
    description: string;
    /** Active questions in the bank — what a paper could draw from. */
    questionCount: number;
    /** False when the bank is under MIN_CATEGORY_QUESTIONS: shown, disabled. */
    available: boolean;
    /** The member's recorded level, null when they do not follow the category. */
    level: SkillLevel | null;
    lastScore: number | null;
    /** retakeRecommended() over a followed category. Never true when unavailable. */
    recommended: boolean;
    /** An open run to resume instead of starting a fresh one. */
    inProgressAssessmentId: number | null;
}

export interface AssessmentsOverview {
    baseline: BaselineStatus;
    options: AssessmentOption[];
}

/**
 * Everything the assessments page renders (SP-040).
 *
 * Only what the database actually offers: the baseline's real state for this
 * member, and the active categories with their active-question banks counted.
 * Nothing here is hardcoded — a category an admin fills past the minimum
 * appears on the next load, one that empties out drops to disabled.
 */
export async function getAssessmentsOverview(
    userId: string,
): Promise<Result<AssessmentsOverview, AppError>> {
    const supabase = await createClient();

    const [submitted, inProgressBaseline, categories, interests, openRuns] = await Promise.all([
        assessmentRepo.findByStatus(supabase, userId, GENERAL_KNOWLEDGE_CATEGORY_ID, 'submitted'),
        assessmentRepo.findByStatus(supabase, userId, GENERAL_KNOWLEDGE_CATEGORY_ID, 'in_progress'),
        categoryRepo.listStartable(supabase),
        profileRepo.listInterests(supabase, userId),
        assessmentRepo.listInProgress(supabase, userId),
    ]);

    // The category list is the page; without it there is nothing to render.
    // The member-specific reads degrade instead: a failed interests read means
    // no recommendations, not an error page.
    if (!categories.ok) return err(categories.error);

    const submittedRow = unwrapOr(submitted, null);
    const openBaseline = unwrapOr(inProgressBaseline, null);

    const baseline: BaselineStatus = submittedRow
        ? { state: 'submitted', assessmentId: submittedRow.assessment_id }
        : openBaseline
          ? { state: 'in_progress', assessmentId: openBaseline.assessment_id }
          : { state: 'not_started', assessmentId: null };

    const interestByCategory = new Map(
        unwrapOr(interests, []).map((interest) => [interest.categoryId, interest]),
    );
    const runByCategory = unwrapOr(openRuns, new Map<number, number>());

    const options = categories.value.map((category): AssessmentOption => {
        const interest = interestByCategory.get(category.categoryId);
        const available = category.questionCount >= MIN_CATEGORY_QUESTIONS;

        return {
            categoryId: category.categoryId,
            name: category.name,
            description: category.description,
            questionCount: category.questionCount,
            available,
            level: interest?.level ?? null,
            lastScore: interest?.lastScore ?? null,
            recommended:
                available && interest !== undefined && retakeRecommended(interest.lastScore),
            inProgressAssessmentId: runByCategory.get(category.categoryId) ?? null,
        };
    });

    return ok({ baseline, options });
}

/**
 * Everything the run page renders. Not this member's run -> not_found, and the
 * error deliberately cannot say whether the id exists (SP-053 AC2).
 */
export async function getRun(
    userId: string,
    assessmentId: number,
): Promise<Result<AssessmentRun, AppError>> {
    const supabase = await createClient();

    const assessment = await assessmentRepo.findOwn(supabase, userId, assessmentId);
    if (!assessment.ok) return err(assessment.error);
    if (!assessment.value) return err(appError('not_found', 'Not found.'));

    const row = assessment.value;
    const questions = await responseRepo.listForRun(supabase, assessmentId);
    if (!questions.ok) return err(questions.error);

    // Headline material only — a failed read degrades the title, not the run.
    const category = await categoryRepo.findById(supabase, row.category_id);

    return ok({
        assessmentId: row.assessment_id,
        categoryId: row.category_id,
        categoryName: category.ok ? category.value.name : 'Assessment',
        status: row.status,
        // started_at is written at creation; the fallback only defends against
        // rows created before this slice existed.
        startedAt: row.started_at ?? row.created_at,
        timeLimitSeconds: row.time_limit_seconds ?? BASELINE_TIME_LIMIT_SECONDS,
        questions: questions.value,
    });
}

/**
 * Record one selection (SP-043). Ownership first, then state, then clock —
 * the server's clock, measured from started_at, which is why a frozen client
 * timer gains nothing (SP-045 AC2). The grace covers latency, not cheating.
 */
export async function saveAnswer(
    userId: string,
    assessmentId: number,
    questionId: number,
    answerId: number,
): Promise<Result<void, AppError>> {
    const supabase = await createClient();

    const assessment = await assessmentRepo.findOwn(supabase, userId, assessmentId);
    if (!assessment.ok) return err(assessment.error);
    if (!assessment.value) return err(appError('not_found', 'Not found.'));

    const row = assessment.value;
    if (row.status !== 'in_progress') {
        return err(appError('conflict', 'This assessment has already been submitted.'));
    }

    const startedAt = row.started_at ?? row.created_at;
    const limit = (row.time_limit_seconds ?? BASELINE_TIME_LIMIT_SECONDS) + TIMER_GRACE_SECONDS;
    if (hasExpired(startedAt, limit, new Date())) {
        return err(appError('conflict', 'Time is up — this answer no longer counts.'));
    }

    return responseRepo.saveSelection(supabase, assessmentId, questionId, answerId);
}
