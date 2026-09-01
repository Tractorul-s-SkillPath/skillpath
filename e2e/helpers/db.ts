/**
 * The test project, read and written directly — the journey's oracle.
 *
 * Story: SP-101
 *
 * This is the one place in the suite allowed to talk to Supabase without going
 * through the application, and it exists for two jobs the browser cannot do:
 *
 *  1. **Know the answer key.** `answers.is_correct` never reaches a student
 *     page — that is the whole design of question.service. So the test reads it
 *     here and uses it to decide, per question, whether to answer correctly.
 *     That is what turns "a score appeared" into "the score is exactly 60%",
 *     which is the only version of this assertion that can fail when
 *     grade_assessment() breaks.
 *
 *  2. **Confirm the server wrote to THIS project.** Every read below is against
 *     the URL in .env.e2e. If the app under test were still pointed at the demo
 *     project, the row the browser just created would not be here.
 *
 * Works with the anon key alone because RLS is off (ARCHITECTURE §0). When
 * SP-004 turns it on, these reads need the service role and this file is where
 * that change lands.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/supabase/database.types';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../lib/domain/constants';
import type { SkillLevel } from '../../lib/domain/types';
import { e2eEnv } from './env';

export type TestDb = SupabaseClient<Database>;

let cached: TestDb | null = null;

export function testDb(): TestDb {
    if (!cached) {
        const env = e2eEnv();
        cached = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    return cached;
}

/** One option, carrying the id so a click can be checked against a stored row. */
export interface AnswerOption {
    answerId: number;
    text: string;
}

/** One baseline question, with the bit the browser is never told. */
export interface AnswerKeyEntry {
    questionId: number;
    difficulty: SkillLevel;
    topicTitle: string | null;
    studyAdvice: string | null;
    correct: AnswerOption;
    wrong: AnswerOption[];
}

/**
 * The baseline paper's answer key, keyed by question text.
 *
 * Keyed by TEXT, not position: the spec matches what the browser renders
 * against this map, so the test never assumes the order the paper comes back
 * in. `startBaseline` happens to take them in ascending question_id and the
 * seed happens to insert beginner-first, but a test that depends on both goes
 * red the day either changes for a good reason.
 */
export async function readBaselineAnswerKey(db: TestDb): Promise<Map<string, AnswerKeyEntry>> {
    const { data: questions, error } = await db
        .from('questions')
        .select('question_id, text, difficulty, topic_title, study_advice')
        .eq('category_id', GENERAL_KNOWLEDGE_CATEGORY_ID)
        .eq('status', 'active')
        .order('question_id', { ascending: true });

    if (error) throw new Error(`Could not read the baseline bank: ${error.message}`);

    const ids = questions.map((q) => q.question_id);

    const { data: answers, error: answerError } = await db
        .from('answers')
        .select('answer_id, question_id, answer_text, is_correct')
        .in('question_id', ids);

    if (answerError) throw new Error(`Could not read the answer key: ${answerError.message}`);

    const key = new Map<string, AnswerKeyEntry>();

    for (const question of questions) {
        const options = answers.filter((a) => a.question_id === question.question_id);
        const correct = options.filter((a) => a.is_correct);

        const wrong = options.filter((a) => !a.is_correct);

        // A baseline question with no single correct answer would make the
        // expected score unknowable, and the test would "fail" for a reason
        // that has nothing to do with the code under test. Say so instead.
        //
        // The wrong-answer check matters for the same reason and is easier to
        // miss: the journey deliberately misses eight questions, and with no
        // wrong option to pick it would fall through to `undefined` — which
        // matches the FIRST radio rather than none, answering something
        // arbitrary and then reporting the resulting score as a grading bug.
        if (correct.length !== 1 || wrong.length === 0) {
            throw new Error(
                `Baseline question ${question.question_id} has ${correct.length} correct and ` +
                    `${wrong.length} wrong answers; the paper needs exactly 1 correct and at ` +
                    'least 1 wrong. Re-run `npm run seed:e2e` against the test project.',
            );
        }

        const option = (a: (typeof options)[number]): AnswerOption => ({
            answerId: a.answer_id,
            text: a.answer_text,
        });

        key.set(question.text, {
            questionId: question.question_id,
            difficulty: question.difficulty,
            topicTitle: question.topic_title,
            studyAdvice: question.study_advice,
            correct: option(correct[0]),
            wrong: wrong.map(option),
        });
    }

    return key;
}

export async function findUserByEmail(db: TestDb, email: string) {
    const { data, error } = await db
        .from('users')
        .select('user_id, email, first_name, last_name, role, status')
        .eq('email', email)
        .maybeSingle();

    if (error) throw new Error(`Could not look up ${email}: ${error.message}`);

    return data;
}

export async function assessmentsFor(db: TestDb, userId: number) {
    const { data, error } = await db
        .from('assessments')
        .select('assessment_id, category_id, status, total_score, submitted_at')
        .eq('user_id', userId);

    if (error) throw new Error(`Could not read assessments: ${error.message}`);

    return data;
}

/**
 * What the server actually stored for each question of a run, by question id.
 *
 * Deliberately the ANSWER ID and not a count. A count only proves something was
 * saved; it cannot tell a broken `saveAnswer` from a broken `grade_assessment`,
 * and separating those two is the entire reason this journey exists. If the
 * wrong option were stored, the score would come back wrong and the SQL
 * function would take the blame for it.
 */
export async function storedAnswers(
    db: TestDb,
    assessmentId: number,
): Promise<Map<number, number | null>> {
    const { data, error } = await db
        .from('student_responses')
        .select('question_id, selected_answer_id')
        .eq('assessment_id', assessmentId);

    if (error) throw new Error(`Could not read responses: ${error.message}`);

    return new Map(data.map((row) => [row.question_id, row.selected_answer_id]));
}

export async function planFor(db: TestDb, userId: number) {
    const { data, error } = await db
        .from('recommendation_plans')
        .select('recommendation_id, category_id, topic_title, priority, progress_status')
        .eq('user_id', userId)
        .order('priority', { ascending: true });

    if (error) throw new Error(`Could not read the plan: ${error.message}`);

    return data;
}

/**
 * Removes one member and everything hanging off them, child rows first.
 *
 * Best-effort by design: this runs after the assertions, and a cleanup that can
 * fail a green test is worse than a test project with a few stray rows in it.
 * Nothing here is load-bearing — every run uses a fresh identity, so a failed
 * delete costs housekeeping, never correctness.
 */
export async function deleteMember(db: TestDb, userId: number): Promise<void> {
    const runs = await assessmentsFor(db, userId).catch(() => []);
    const ids = runs.map((r) => r.assessment_id);

    if (ids.length > 0) {
        await db.from('student_responses').delete().in('assessment_id', ids);
    }

    await db.from('xp_events').delete().eq('user_id', userId);
    await db.from('recommendation_plans').delete().eq('user_id', userId);
    await db.from('assessments').delete().eq('user_id', userId);
    await db.from('category_progress').delete().eq('user_id', userId);
    await db.from('users').delete().eq('user_id', userId);
}
