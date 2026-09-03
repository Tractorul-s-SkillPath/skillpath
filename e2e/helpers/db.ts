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
        // Service role, not anon: RLS is on in the test project and the anon
        // role matches no policy, so every read came back empty and every
        // fixture insert was rejected with 42501.
        cached = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
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

    // A Map keyed by text silently keeps the LAST of any duplicate pair, and
    // the spec looks each rendered card up by its text — so a bank with two
    // questions worded the same would answer one of them against the other's
    // key. That surfaces as a wrong percentage on the results page, which is
    // precisely the signal this journey exists to make trustworthy, arriving
    // for a reason that has nothing to do with grade_assessment().
    if (key.size !== questions.length) {
        throw new Error(
            `The baseline bank has ${questions.length} questions but only ${key.size} distinct ` +
                'texts. The answer key is keyed by question text, so a duplicate collapses and ' +
                'the paper would be answered against the wrong entry. Find the repeated text in ' +
                'the questions table — `npm run seed:e2e` will not fix it, it skips texts that ' +
                'already exist.',
        );
    }

    return key;
}

export async function findCategoryByName(db: TestDb, name: string) {
    const { data, error } = await db
        .from('skill_categories')
        .select('category_id, name, status')
        .eq('name', name)
        .maybeSingle();

    if (error) throw new Error(`Could not look up category "${name}": ${error.message}`);

    return data;
}

/** One admin-written question, read back with the key the admin form set. */
export interface BankQuestion {
    questionId: number;
    text: string;
    status: string;
    difficulty: SkillLevel;
    createdBy: string | null;
    answers: Array<{ answerId: number; text: string; isCorrect: boolean; position: number }>;
}

/**
 * A category's whole bank, whatever its status.
 *
 * Deliberately NOT filtered to active: `insertWithAnswers` never sets `status`,
 * so an admin-created question is active only because the column defaults that
 * way, and there are no migrations in the repository to read that default out
 * of (ARCHITECTURE §0). A question that came back `inactive` would never be
 * drawn into a paper, and the spec would report "the student was not served it"
 * — true, and the wrong diagnosis. Reading the status back lets it say which.
 */
export async function questionsInCategory(
    db: TestDb,
    categoryId: number,
): Promise<BankQuestion[]> {
    const { data, error } = await db
        .from('questions')
        // One string literal, not a concatenation: supabase-js infers the row
        // type from the select AS A LITERAL TYPE, and `'a' + 'b'` widens to
        // `string`, which infers to GenericStringError and fails the build.
        .select('question_id, text, status, difficulty, created_by, answers(answer_id, answer_text, is_correct, position)')
        .eq('category_id', categoryId)
        .order('question_id', { ascending: true });

    if (error) throw new Error(`Could not read category ${categoryId}: ${error.message}`);

    return data.map((row) => ({
        questionId: row.question_id,
        text: row.text,
        status: row.status,
        difficulty: row.difficulty,
        createdBy: row.created_by,
        answers: [...row.answers]
            .sort((a, b) => a.position - b.position)
            .map((answer) => ({
                answerId: answer.answer_id,
                text: answer.answer_text,
                isCorrect: answer.is_correct,
                position: answer.position,
            })),
    }));
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

export async function assessmentsFor(db: TestDb, userId: string) {
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

export async function planFor(db: TestDb, userId: string) {
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
export async function deleteMember(db: TestDb, userId: string): Promise<void> {
    const runs = await assessmentsFor(db, userId).catch(() => []);
    const ids = runs.map((r) => r.assessment_id);

    if (ids.length > 0) {
        await db.from('student_responses').delete().in('assessment_id', ids);
    }

    await db.from('xp_events').delete().eq('user_id', userId);
    await db.from('recommendation_plans').delete().eq('user_id', userId);
    await db.from('assessments').delete().eq('user_id', userId);
    await db.from('category_progress').delete().eq('user_id', userId);

    // The AUTH user last, not the profile row. `public.users.user_id` cascades
    // from `auth.users(id)`, so this removes both — and removing only the
    // profile would strand an account still holding the email address, which
    // nothing in this suite ever looks at and which no later run can reuse.
    //
    // This is also what stops the test project accumulating a member per run:
    // 35 `@skillpath.test` rows had built up while cleanup deleted a profile
    // row that a foreign key immediately recreated the need for.
    await db.auth.admin.deleteUser(userId);
}

/**
 * Removes a category the admin spec invented, and its bank with it.
 *
 * NOT best-effort, unlike deleteMember. A leftover member is invisible to
 * everybody else; a leftover *category* is active, has a full bank, and shows
 * up on the /assessments page of every student in the project — one more per
 * run, forever. So this one reports what it could not remove and names the id
 * to delete by hand.
 *
 * Order is forced by the foreign keys, and one of them reaches outside this
 * function: `student_responses.question_id`. Delete the member who sat the
 * paper FIRST, or these questions are still referenced and will not go.
 */
export async function deleteCategory(db: TestDb, categoryId: number): Promise<void> {
    const { data: questions, error: readError } = await db
        .from('questions')
        .select('question_id')
        .eq('category_id', categoryId);

    if (readError) throw new Error(`Could not read category ${categoryId}: ${readError.message}`);

    const ids = questions.map((q) => q.question_id);

    if (ids.length > 0) {
        // `answers` cascades from `questions`, but the two databases were built
        // by hand at different times (ARCHITECTURE §0) and the cascade is not
        // something this repository can point at. Explicit costs one request.
        const { error } = await db.from('answers').delete().in('question_id', ids);
        if (error) throw new Error(`Could not remove answers: ${error.message}`);

        const { error: questionError } = await db
            .from('questions')
            .delete()
            .in('question_id', ids);
        if (questionError) throw new Error(`Could not remove questions: ${questionError.message}`);
    }

    const { error } = await db.from('skill_categories').delete().eq('category_id', categoryId);
    if (error) throw new Error(`Could not remove category ${categoryId}: ${error.message}`);
}
