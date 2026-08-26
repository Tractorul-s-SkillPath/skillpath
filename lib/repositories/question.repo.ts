/**
 * questions + answers tables.
 *
 * Layer: REPOSITORY
 * Stories: SP-034, SP-035, SP-036, SP-037, SP-084, SP-092
 *
 * ON THE "SERVICE ROLE ONLY" THIS FILE USED TO CLAIM: there is no service-role
 * client. `answers` is revoked from anon only once RLS lands, and it has not —
 * ARCHITECTURE §3 says to build lib/supabase/admin.ts alongside 0003_rls.sql
 * and not before. Until then the anon client reads this table like every other
 * one, and assertAdmin() upstream is the only thing gating it. That is a real
 * limitation, written down rather than papered over.
 *
 * WHAT MUST STAY TRUE REGARDLESS: `isCorrect` leaves this file only inside
 * AdminQuestion. Nothing student-facing may call these functions (SP-038).
 *
 * Test: tests/lib/repositories/question.repo.test.ts (integration)
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SkillLevel } from '../supabase/database.types';
import { fromPostgrestError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';
import type { AdminQuestion } from '../domain/types';
import { toAdminQuestion } from './mappers';
import type { ContentStatus } from '../supabase/database.types';

type Client = SupabaseClient<Database>;

export interface NewAnswer {
    text: string;
    isCorrect: boolean;
}

export interface NewQuestion {
    categoryId: number;
    text: string;
    difficulty: SkillLevel;
    answers: NewAnswer[];
    /** The admin writing it. Recorded so an AI-generated bank stays tellable apart. */
    createdBy: number;
}

/**
 * Every question in one category, newest first, each with its answer key.
 *
 * One request: the options come back as an embed rather than a second query per
 * question.
 */
export async function listByCategory(
    supabase: Client,
    categoryId: number,
): Promise<Result<AdminQuestion[], AppError>> {
    const { data, error } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('category_id', categoryId)
        .order('question_id', { ascending: false });

    if (error) return err(fromPostgrestError(error, 'questions.listByCategory'));

    return ok(data.map((row) => toAdminQuestion(row, row.answers)));
}

/**
 * A question and its options, written together.
 *
 * TWO THINGS THAT WERE WRONG HERE AND ARE WORTH KEEPING FIXED:
 *
 * 1. `position` is set explicitly. The column defaults to 0 and
 *    `answers_position_unique` is UNIQUE (question_id, position), so inserting
 *    four options without positions is four rows claiming slot 0 — the whole
 *    batch fails on the second one. It also fixes the display order, which
 *    otherwise is whatever the planner returns.
 *
 * 2. The question is removed again if the options fail. PostgREST gives us no
 *    transaction across two requests, so the alternative is a question row with
 *    no answers — and an active question with no options is one that can be
 *    drawn into a real assessment and shown to a student as a blank page.
 *    Deleting the parent takes the partial answers with it (`on delete cascade`).
 *
 * The proper fix for (2) is one `SECURITY DEFINER` function doing both inserts
 * in a single statement, the way grade_assessment() does. That is a migration
 * and a story of its own; this is the honest version until then.
 */
export async function insertWithAnswers(
    supabase: Client,
    question: NewQuestion,
): Promise<Result<number, AppError>> {
    const { data, error } = await supabase
        .from('questions')
        .insert({
            category_id: question.categoryId,
            text: question.text,
            difficulty: question.difficulty,
            source: 'manual',
            created_by: question.createdBy,
        })
        .select('question_id')
        .single();

    if (error) return err(fromPostgrestError(error, 'questions.insert'));

    const questionId = data.question_id;

    const { error: answersError } = await supabase.from('answers').insert(
        question.answers.map((answer, position) => ({
            question_id: questionId,
            answer_text: answer.text,
            is_correct: answer.isCorrect,
            position,
        })),
    );

    if (answersError) {
        const { error: rollbackError } = await supabase
            .from('questions')
            .delete()
            .eq('question_id', questionId);

        // Nothing the admin can do about this one, but it must not vanish: it
        // means an option-less question is sitting in the bank.
        if (rollbackError) {
            console.error(
                '[db] questions.insertWithAnswers: could not remove question',
                questionId,
                'after its answers failed:',
                rollbackError.message,
            );
        }

        return err(fromPostgrestError(answersError, 'answers.insert'));
    }

    return ok(questionId);
}


/**
 * `client` is typed, like every other function here. It was `any` for one
 * commit, and in that commit this read `.from('question')` — a table that does
 * not exist. `any` had nothing to check it against, so it compiled, shipped,
 * and needed 69a1aee to correct the name. The annotation is the check.
 */
export async function setStatus(
    client: Client,
    questionId: number,
    status: ContentStatus
): Promise<Result<void, AppError>> {
    const { error } = await client
        .from('questions')
        .update({ status })
        .eq('question_id', questionId);

    if (error) {
        return { ok: false, error: { message: error.message } as AppError };
    }

    return { ok: true, value: undefined };
}
