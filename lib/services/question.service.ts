/**
 * Question bank.
 *
 * Layer: SERVICE
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037, SP-084
 *
 * Every function starts with assertAdmin(). This is the one slice of
 * authorization the project consciously moved out of the database and into
 * code — `answers.is_correct` is the answer key, and with no RLS the only thing
 * keeping it away from a student is the check at the top of these functions.
 * That makes it the slice that needs the most tests.
 *
 * updateQuestion and setStatus are not written yet. Both have a constraint
 * worth stating before anybody adds them: an update MUST NOT touch
 * `student_responses.is_correct`, because that column is a snapshot of what a
 * member was told at the time (D4), and activating a question with no correct
 * option has to be refused rather than stored.
 *
 * Test: tests/lib/services/question.service.test.ts
 */

import 'server-only';
import { assertAdmin } from '../auth/assertAdmin';
// createServiceClient, NOT createClient: RLS has no admin policy, deliberately.
//
// The policies in *_securitate_rls.sql are all `auth.uid()` = own rows, plus
// read-only SELECT on the content bank. An admin client on the anon key is
// therefore refused every write here — `42501 new row violates row-level
// security policy for table "skill_categories"` was this file creating a
// category through the member's own session.
//
// The fix is not an is_admin() policy. That would put the role check in the
// database AND in assertAdmin(), where the two can drift; ARCHITECTURE §5c puts
// it in one place. EVERY exported function below calls assertAdmin() before it
// touches this client, and that is the whole of the authorization story.
import { createServiceClient } from '../supabase/server';
import * as questionRepo from '../repositories/question.repo';
import type { AppError } from '../errors';
import type { Result } from '../result';
import type { AdminQuestion } from '../domain/types';
import type { QuestionInput } from '../validation/question.schema';
import type { ContentStatus } from '../supabase/database.types';

/**
 * The bank for one category, answer keys included.
 *
 * Not paged, deliberately: this is scoped to a single category and the create
 * form sits beside it. If a category ever grows past a screenful, this grows a
 * `Page<AdminQuestion>` the way the users and results lists have one.
 */
export async function listQuestionsByCategory(
    categoryId: number,
): Promise<Result<AdminQuestion[], AppError>> {
    await assertAdmin();
    return questionRepo.listByCategory(createServiceClient(), categoryId);
}

/**
 * `created_by` comes from the session, never from the form (§5) — the same rule
 * every user-scoped write in this codebase follows.
 */
export async function createQuestion(input: QuestionInput): Promise<Result<number, AppError>> {
    const admin = await assertAdmin();

    return questionRepo.insertWithAnswers(createServiceClient(), {
        categoryId: input.categoryId,
        text: input.text,
        difficulty: input.difficulty,
        answers: input.answers,
        createdBy: admin.userId,
    });
}

/**
 * Activate or deactivate a question.
 * A deactivated question remains in the database to preserve student history
 * but will no longer be selected for new assessments.
 */
export async function setQuestionStatus(
    questionId: number,
    status: ContentStatus,
): Promise<Result<void, AppError>> {
    await assertAdmin();
    return questionRepo.setStatus(createServiceClient(), questionId, status);
}
