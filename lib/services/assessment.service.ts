/**
 * Assessment lifecycle — the baseline run, for now.
 *
 * Layer: SERVICE
 * Stories: SP-041, SP-042, SP-043, SP-044, SP-112, SP-113
 *
 * BASELINE ONLY, DELIBERATELY. The category is pinned to
 * GENERAL_KNOWLEDGE_CATEGORY_ID and the paper is the fixed 20 in seed order —
 * the same paper for everybody, by team decision, until randomisation lands.
 * When /assessments/new grows real, startBaseline() becomes the special case
 * of a generate(categoryId, level) that draws instead of listing.
 *
 * Test: tests/lib/services/assessment.service.test.ts
 */

import 'server-only';
import { createClient } from '../supabase/server';
import * as assessmentRepo from '../repositories/assessment.repo';
import * as responseRepo from '../repositories/response.repo';
import {
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
    TIMER_GRACE_SECONDS,
} from '../domain/constants';
import { hasExpired } from '../domain/timer';
import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { AssessmentRun } from '../domain/types';

/** Where startBaseline wants the member sent. The action just follows it. */
export type BaselineStart =
    | { kind: 'run'; assessmentId: number }
    | { kind: 'results'; assessmentId: number };

/**
 * Find or create the member's baseline run (SP-112).
 *
 * Order matters: submitted first — the attempt is spent and the only place to
 * go is the results. Then in-progress — closing the tab mid-run resumes, it
 * does not restart (SP-042: the check is the first line of defence, the
 * partial unique index would be the backstop once it exists). Only then create.
 */
export async function startBaseline(userId: number): Promise<Result<BaselineStart, AppError>> {
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
    const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('question_id')
        .eq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .eq('status', 'active')
        .order('question_id', { ascending: true });

    if (questionsError) {
        console.error('[db] questions.baseline:', questionsError.message);
        return err(appError('unavailable', 'The assessment could not be loaded. Try again.'));
    }

    // A short paper places people wrongly, which is worse than refusing
    // (SP-111 AC3). The dashboard card checks this too; this is the backstop.
    if (questions.length < BASELINE_QUESTION_COUNT) {
        return err(
            appError('unavailable', 'The baseline assessment is not fully set up yet. Try again later.'),
        );
    }

    const created = await assessmentRepo.createWithResponses(supabase, {
        userId,
        categoryId: GENERAL_KNOWLEDGE_CATEGORY_ID,
        // The paper mixes all three; the column is NOT NULL, so it records
        // where the ramp starts rather than a level anybody chose.
        requestedLevel: 'beginner',
        timeLimitSeconds: BASELINE_TIME_LIMIT_SECONDS,
        questionIds: questions.slice(0, BASELINE_QUESTION_COUNT).map((q) => q.question_id),
    });
    if (!created.ok) return err(created.error);

    return ok({ kind: 'run', assessmentId: created.value });
}

/**
 * Everything the run page renders. Not this member's run -> not_found, and the
 * error deliberately cannot say whether the id exists (SP-053 AC2).
 */
export async function getRun(
    userId: number,
    assessmentId: number,
): Promise<Result<AssessmentRun, AppError>> {
    const supabase = await createClient();

    const assessment = await assessmentRepo.findOwn(supabase, userId, assessmentId);
    if (!assessment.ok) return err(assessment.error);
    if (!assessment.value) return err(appError('not_found', 'Not found.'));

    const row = assessment.value;
    const questions = await responseRepo.listForRun(supabase, assessmentId);
    if (!questions.ok) return err(questions.error);

    return ok({
        assessmentId: row.assessment_id,
        categoryId: row.category_id,
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
    userId: number,
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
