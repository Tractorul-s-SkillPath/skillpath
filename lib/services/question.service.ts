/**
 * Question bank.
 *
 * Layer: SERVICE
 * Stories: SP-033, SP-034, SP-035, SP-036, SP-037, SP-084, SP-092
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
import * as categoryRepo from '../repositories/category.repo';
import { draftQuestions } from './ai.service';
import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { AdminQuestion } from '../domain/types';
import type { QuestionInput, GenerateQuestionsInput } from '../validation/question.schema';
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
        topicTitle: input.topicTitle,
        studyAdvice: input.studyAdvice,
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

/**
 * Generate AI drafts and put them in the bank, inactive (SP-092).
 *
 * assertAdmin() first, like everything else in this file — the generator is a
 * new door into `answers.is_correct` and it gets the same lock as the old ones.
 *
 * HUMAN IN THE LOOP IS ENFORCED BY TWO FIELDS, NOT BY A CONVENTION:
 * `status: 'inactive'` means the question cannot be drawn into an assessment
 * (`questions_pick_idx` and every draw filter are on status), and
 * `source: 'ai'` means the screen can say so. Neither is a default anywhere —
 * they are passed explicitly, right here, and this is the only call site in
 * the codebase that passes them.
 *
 * PARTIAL SUCCESS IS REPORTED, NOT HIDDEN. Each draft is its own insert, and
 * one that fails does not take the others with it. The admin is told how many
 * landed, because "5 drafts added" when three of them are missing is worse
 * than a number that does not match what they asked for.
 */
export async function generateDraftQuestions(
    input: GenerateQuestionsInput,
): Promise<Result<{ added: number; requested: number }, AppError>> {
    const admin = await assertAdmin();

    // The model is given the category's NAME, so it has to be read. A category
    // that does not exist is the admin's error, not the generator's.
    const category = await categoryRepo.findById(createServiceClient(), input.categoryId);
    if (!category.ok) return err(category.error);

    const drafts = await draftQuestions(admin.userId, {
        categoryId: input.categoryId,
        categoryName: category.value.name,
        difficulty: input.difficulty,
        count: input.count,
    });

    if (!drafts.ok) return err(drafts.error);

    const supabase = createServiceClient();
    let added = 0;

    for (const draft of drafts.value) {
        const inserted = await questionRepo.insertWithAnswers(supabase, {
            categoryId: draft.categoryId,
            text: draft.text,
            difficulty: draft.difficulty,
            topicTitle: draft.topicTitle,
            studyAdvice: draft.studyAdvice,
            answers: draft.answers,
            createdBy: admin.userId,
            source: 'ai',
            status: 'inactive',
        });

        if (inserted.ok) added++;
        else console.error('[questions] draft not stored:', inserted.error.message);
    }

    if (added === 0) {
        return err(appError('unknown', 'The drafts could not be saved. Try again.'));
    }

    // `input.count`, NOT `drafts.value.length`. This used to report the latter,
    // which is the number of drafts that SURVIVED validation — so an admin who
    // asked for ten and got six usable ones saw "6 drafts added" rather than
    // "6 of 10", and the only shortfall the screen could ever show was a failed
    // insert. The number the admin is owed is the one they typed.
    return ok({ added, requested: input.count });
}

/**
 * Reject a draft — the delete half of SP-092 AC3.
 *
 * NARROW ON PURPOSE. Only an inactive, AI-generated question can be deleted
 * here. Everything else in the bank retires with setQuestionStatus, because
 * `student_responses.is_correct` is a snapshot of what a member was told (D4)
 * and a hand-written question that has been served is history. A draft nobody
 * was ever shown is not.
 *
 * The check is here rather than only in the repository because this is where
 * the rule is a product decision. The database's `on delete restrict` on
 * `student_responses` is the backstop for the case this check cannot see: a
 * draft that was activated, answered, and deactivated again.
 */
export async function deleteDraftQuestion(questionId: number): Promise<Result<void, AppError>> {
    await assertAdmin();

    const supabase = createServiceClient();

    const existing = await questionRepo.findById(supabase, questionId);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) return err(appError('not_found', 'That question no longer exists.'));

    if (existing.value.source !== 'ai' || existing.value.status !== 'inactive') {
        // Deliberately one message for both halves. "It is not a draft" is all
        // an admin needs; which of the two conditions failed is a detail.
        return err(
            appError(
                'conflict',
                'Only an inactive AI draft can be deleted. Deactivate a live question instead — that keeps the answers members have already given.',
            ),
        );
    }

    return questionRepo.remove(supabase, questionId);
}
