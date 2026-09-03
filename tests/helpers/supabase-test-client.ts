/**
 * Clients and fixtures for the database-backed tests.
 *
 * Used by tests/db and tests/lib/repositories only.
 *
 * Points at the SEPARATE Supabase test project named by `.env.e2e`, and refuses
 * to start if that is the same project `.env.local` names. If these tests can
 * reach the project the demo runs on, that is the incident, not the test
 * failure.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE DOES NOT MATCH THE SKETCH IT REPLACED, AND THE DIFFERENCE MATTERS.
 * ---------------------------------------------------------------------------
 *
 * The sketch promised four things:
 *
 *     adminClient()            service role, for arranging state
 *     studentClient(userId)    a real anon-key client with a real user token
 *     adminUserClient()        the same, for a user whose role is 'admin'
 *     resetDatabase()          truncate in FK order, then reseed, between suites
 *
 * The first three describe Supabase Auth plus Row Level Security. This project
 * has neither (ARCHITECTURE §0): there is a plain `users` table and a signed
 * cookie of our own, so there is no user token to hold, and RLS is off, so the
 * anon key already reads and writes every table. A `studentClient(userId)` here
 * could only be the same anon client with a label on it — and a label that
 * implies an authorization boundary nobody applied is worse than no helper at
 * all, because every assertion written against it would pass for the wrong
 * reason. So there is ONE client, named for what it is.
 *
 * `resetDatabase()` is gone for a different reason: truncate-and-reseed makes
 * every test file own the whole database, which means they cannot run in
 * parallel and any one of them can wipe another's rows. `Sandbox` below is the
 * replacement — each test creates only the rows it needs, tagged uniquely, and
 * removes exactly those. The seeded bank is read, never written.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database, SkillLevel, UserRole, UserStatus } from '../../lib/supabase/database.types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export type TestClient = SupabaseClient<Database>;

/**
 * Reads a `.env`-shaped file. Same handful of lines as `scripts/lib.mjs` and
 * `e2e/helpers/env.ts`, and deliberately not shared with either: those two run
 * under `node` and Playwright respectively, and importing across the three
 * runtimes to save five lines buys a resolution problem instead.
 */
function readEnvFile(file: string): Record<string, string> {
    let raw: string;

    try {
        raw = readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
        return {};
    }

    const values: Record<string, string> = {};

    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;

        values[trimmed.slice(0, eq).trim()] = trimmed
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
    }

    return values;
}

let cached: TestClient | null = null;

export function testClient(): TestClient {
    if (cached) return cached;

    const file = readEnvFile('.env.e2e');

    // Real environment wins so CI needs no file. An EMPTY value counts as
    // missing: `.env.e2e` ships with the names present and the values blank,
    // and anything treating '' as a value hands the empty string to supabase-js
    // and fails with "supabaseUrl is required" from twelve frames inside a
    // library rather than here, where the fix is.
    const read = (name: string): string | undefined =>
        (process.env[name] || file[name] || '').trim() || undefined;

    const url = read('NEXT_PUBLIC_SUPABASE_URL');
    // Service role, not anon. These tests insert fixture rows into every table;
    // with RLS on in the test project the anon role satisfies no policy, so the
    // sandbox failed 144 of 146 specs with "new row violates row-level security
    // policy for table users" before it could assert anything.
    const key = read('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
        throw new Error(
            'The database-backed tests need NEXT_PUBLIC_SUPABASE_URL and\n' +
                'SUPABASE_SERVICE_ROLE_KEY for the TEST project.\n\n' +
                'Copy the block at the bottom of .env.example into .env.e2e and fill it in\n' +
                '(Supabase dashboard -> Project Settings -> API Keys). In CI the same names\n' +
                'come from repository secrets.\n\n' +
                'These tests are excluded from `npm test` precisely so a teammate without a\n' +
                'test project is never blocked by this message — you only see it from\n' +
                '`npm run test:db`.',
        );
    }

    const demo = readEnvFile('.env.local');

    // Checked before the url, because this key bypasses RLS: holding the demo
    // project's service-role key is enough to delete its rows whatever the url
    // says.
    if (demo.SUPABASE_SERVICE_ROLE_KEY && demo.SUPABASE_SERVICE_ROLE_KEY === key) {
        throw new Error(
            'REFUSING TO RUN: SUPABASE_SERVICE_ROLE_KEY in .env.e2e is the demo project\'s key,\n' +
                'the one in .env.local.\n\n' +
                'These tests insert and delete rows in every table, and a service-role key goes\n' +
                'straight through RLS to do it.\n\n' +
                'Use the TEST project\'s service_role key.',
        );
    }

    const demoUrl = demo.NEXT_PUBLIC_SUPABASE_URL;

    if (demoUrl && demoUrl === url) {
        throw new Error(
            'REFUSING TO RUN: .env.e2e points at the same Supabase project as .env.local.\n\n' +
                'These tests insert and delete rows in every table. Against the demo project\n' +
                'that is data loss, not a test.\n\n' +
                'Create a second Supabase project and put ITS url and publishable key in .env.e2e.',
        );
    }

    cached = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return cached;
}

/**
 * A string no other run can collide with.
 *
 * Every fixture below is named through this. Two things depend on it: `users`
 * and `skill_categories` both have unique names, so a fixed fixture name means
 * the second run of the suite fails on a duplicate key; and a failed teardown
 * would otherwise poison every later run rather than leaving one stray row.
 */
export function uniqueTag(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SandboxUser {
    userId: number;
    email: string;
    firstName: string;
    lastName: string;
}

export interface SandboxQuestion {
    questionId: number;
    text: string;
    correctAnswerId: number;
    wrongAnswerIds: number[];
}

/**
 * The rows one test file made, and the only rows it may remove.
 *
 * Every `create*` records what it inserted; `destroy()` deletes exactly that,
 * child-first, in the order the foreign keys demand. Nothing here truncates and
 * nothing touches the seeded bank, so two files can run against one project
 * without arranging to take turns.
 *
 * Teardown is NOT best-effort, unlike the e2e helper's. There the rows are one
 * member per run and invisible to everyone; here a leftover `skill_categories`
 * row is active, and every student in the project sees it on /assessments. So
 * `destroy()` reports what it could not delete, with the id to remove by hand.
 */
export class Sandbox {
    private readonly db: TestClient;
    private readonly tag: string;

    private readonly userIds: number[] = [];
    private readonly categoryIds: number[] = [];
    private readonly questionIds: number[] = [];
    private readonly assessmentIds: number[] = [];

    constructor(db: TestClient = testClient(), prefix = 'sbx') {
        this.db = db;
        this.tag = uniqueTag(prefix);
    }

    /** The unique suffix every fixture in this sandbox is named with. */
    get name(): string {
        return this.tag;
    }

    async createUser(
        overrides: {
            firstName?: string;
            lastName?: string;
            email?: string;
            role?: UserRole;
            status?: UserStatus;
        } = {},
    ): Promise<SandboxUser> {
        const suffix = `${this.tag}-${this.userIds.length}`;

        const row = {
            first_name: overrides.firstName ?? 'Test',
            last_name: overrides.lastName ?? suffix,
            email: overrides.email ?? `${suffix}@skillpath.test`,
            // NOT NULL, and read by nothing — sign-in is by email alone, by team
            // decision (lib/auth/current-user.ts). The value still has to have
            // the `salt:key` shape or a test that DOES exercise verification
            // would fail on the fixture rather than on the code.
            password: 'aa:bb',
            role: overrides.role ?? ('student' as const),
            status: overrides.status ?? ('active' as const),
        };

        const { data, error } = await this.db
            .from('users')
            .insert(row)
            .select('user_id, email, first_name, last_name')
            .single();

        if (error) throw new Error(`Sandbox could not create a user: ${error.message}`);

        this.userIds.push(data.user_id);

        return {
            userId: data.user_id,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
        };
    }

    async createCategory(
        overrides: { name?: string; description?: string | null; status?: 'active' | 'inactive' } = {},
    ): Promise<{ categoryId: number; name: string }> {
        // The name is capped at 60 characters by skill_categories_name_check, and
        // the tag is most of the budget — so the label goes first and is trimmed,
        // never the tag, which is what keeps the row identifiable.
        const name = overrides.name ?? `Sbx ${this.tag}-${this.categoryIds.length}`.slice(0, 60);

        const { data, error } = await this.db
            .from('skill_categories')
            .insert({
                name,
                description: overrides.description ?? 'Created by a test. Safe to delete.',
                status: overrides.status ?? 'active',
            })
            .select('category_id, name')
            .single();

        if (error) throw new Error(`Sandbox could not create a category: ${error.message}`);

        this.categoryIds.push(data.category_id);

        return { categoryId: data.category_id, name: data.name };
    }

    /**
     * One question with one correct answer and three wrong ones.
     *
     * The answer set is not decoration: `grade_assessment()` scores against
     * `answers.is_correct`, so a fixture question with no correct answer grades
     * every attempt at zero and the failure is reported against the code.
     */
    async createQuestion(
        categoryId: number,
        overrides: {
            text?: string;
            difficulty?: SkillLevel;
            status?: 'active' | 'inactive';
            topicTitle?: string | null;
            studyAdvice?: string | null;
        } = {},
    ): Promise<SandboxQuestion> {
        const index = this.questionIds.length;

        const { data: question, error } = await this.db
            .from('questions')
            .insert({
                category_id: categoryId,
                text: overrides.text ?? `Sandbox question ${index} (${this.tag})`,
                difficulty: overrides.difficulty ?? 'beginner',
                status: overrides.status ?? 'active',
                topic_title: overrides.topicTitle ?? `Topic ${index} ${this.tag}`,
                study_advice: overrides.studyAdvice ?? 'Revisit the chapter.',
            })
            .select('question_id, text')
            .single();

        if (error) throw new Error(`Sandbox could not create a question: ${error.message}`);

        this.questionIds.push(question.question_id);

        const { data: answers, error: answerError } = await this.db
            .from('answers')
            .insert([
                { question_id: question.question_id, answer_text: 'Correct', is_correct: true, position: 1 },
                { question_id: question.question_id, answer_text: 'Wrong A', is_correct: false, position: 2 },
                { question_id: question.question_id, answer_text: 'Wrong B', is_correct: false, position: 3 },
                { question_id: question.question_id, answer_text: 'Wrong C', is_correct: false, position: 4 },
            ])
            .select('answer_id, is_correct');

        if (answerError) throw new Error(`Sandbox could not create answers: ${answerError.message}`);

        return {
            questionId: question.question_id,
            text: question.text,
            correctAnswerId: answers.find((a) => a.is_correct)!.answer_id,
            wrongAnswerIds: answers.filter((a) => !a.is_correct).map((a) => a.answer_id),
        };
    }

    /** A category with `count` questions in it, ready to be sat. */
    async createCategoryWithBank(
        count: number,
        overrides: { name?: string; status?: 'active' | 'inactive' } = {},
    ): Promise<{ categoryId: number; name: string; questions: SandboxQuestion[] }> {
        const category = await this.createCategory(overrides);
        const questions: SandboxQuestion[] = [];

        for (let i = 0; i < count; i += 1) {
            questions.push(await this.createQuestion(category.categoryId));
        }

        return { ...category, questions };
    }

    /**
     * An open run, with one response row per question.
     *
     * `answered_at` is set whenever `selected_answer_id` is — the pair is a
     * check constraint (`student_responses_answered_at_present`), so a fixture
     * that sets only the answer id fails on the insert.
     */
    async createAssessment(
        userId: number,
        categoryId: number,
        questions: SandboxQuestion[],
        overrides: { requestedLevel?: SkillLevel; answerCorrectly?: number } = {},
    ): Promise<{ assessmentId: number }> {
        const { data, error } = await this.db
            .from('assessments')
            .insert({
                user_id: userId,
                category_id: categoryId,
                requested_level: overrides.requestedLevel ?? 'beginner',
                // `status` is deliberately not sent: the generated Insert type
                // does not accept it and the column defaults to 'in_progress',
                // which is what assessment.repo.createWithResponses relies on
                // too. Sending it here would test a path the app never takes.
                started_at: new Date().toISOString(),
            })
            .select('assessment_id')
            .single();

        if (error) throw new Error(`Sandbox could not create an assessment: ${error.message}`);

        this.assessmentIds.push(data.assessment_id);

        if (questions.length > 0) {
            const correctCount = overrides.answerCorrectly ?? 0;

            const rows = questions.map((question, index) => {
                // Omitting `answerCorrectly` leaves the paper blank, which is
                // what an in-progress run looks like before anybody answers.
                // Passing a number answers EVERY question — the first `count`
                // correctly and the rest wrong — so the expected score is
                // exactly count/questions.length and a grading test can pin it.
                const selected =
                    overrides.answerCorrectly === undefined
                        ? null
                        : index < correctCount
                          ? question.correctAnswerId
                          : question.wrongAnswerIds[0];

                return {
                    assessment_id: data.assessment_id,
                    question_id: question.questionId,
                    position: index + 1,
                    selected_answer_id: selected,
                    answered_at: selected === null ? null : new Date().toISOString(),
                };
            });

            const { error: responseError } = await this.db.from('student_responses').insert(rows);

            if (responseError) {
                throw new Error(`Sandbox could not create responses: ${responseError.message}`);
            }
        }

        return { assessmentId: data.assessment_id };
    }

    /**
     * Removes everything this sandbox made, child rows first.
     *
     * The order is the foreign keys' and not a preference. `student_responses`
     * points at both an assessment and a question, so it goes before either;
     * `answers` cascades from `questions` in this project but is deleted
     * explicitly anyway, because with no migrations in the repository
     * (ARCHITECTURE §0) that cascade is a property of one hosted database
     * rather than something the repository can promise.
     */
    async destroy(): Promise<void> {
        // KEEPING THE ROWS SO YOU CAN LOOK AT THEM.
        //
        // The suite is invisible in the Supabase table editor by design: it
        // writes hundreds of rows and removes every one, so the project after a
        // run is byte-for-byte the project before it. That is right for CI and
        // for a shared project, and useless when you want to SEE what a test
        // did.
        //
        //   SKILLPATH_DB_TEST_KEEP=1 npm run test:db
        //
        // leaves everything in place, named with this sandbox's tag so the rows
        // are findable and deletable by hand. Same idea as E2E_CLEAN=1 in the
        // Playwright suite, pointed the other way: that one opts IN to cleaning
        // because keeping is its default, this one opts OUT.
        //
        // Prefer one file to the whole suite — `npm run test:db -- <path>` —
        // because 221 tests' worth of kept rows is a lot to read and a lot to
        // remove afterwards.
        if (process.env.SKILLPATH_DB_TEST_KEEP === '1') {
            // stdout directly, not console.log: Vitest intercepts console
            // output from a hook and, with the default reporter on a passing
            // file, never prints it — so the ids you need in order to find the
            // rows are the one thing you would not get.
            process.stdout.write(
                `\n  [kept] sandbox "${this.tag}" — rows left in the database on purpose.\n` +
                    `         users:      ${this.userIds.join(', ') || '(none)'}\n` +
                    `         categories: ${this.categoryIds.join(', ') || '(none)'}\n` +
                    `         questions:  ${this.questionIds.join(', ') || '(none)'}\n` +
                    `         assessments:${this.assessmentIds.join(', ') || '(none)'}\n` +
                    `         Find them in Supabase by searching for "${this.tag}".\n` +
                    `         Re-run without SKILLPATH_DB_TEST_KEEP to stop keeping them;\n` +
                    `         these particular rows stay until you remove them.\n`,
            );
            return;
        }

        const problems: string[] = [];

        const run = async (what: string, op: PromiseLike<{ error: { message: string } | null }>) => {
            const { error } = await op;
            if (error) problems.push(`${what}: ${error.message}`);
        };

        if (this.assessmentIds.length > 0) {
            await run(
                'student_responses (by assessment)',
                this.db.from('student_responses').delete().in('assessment_id', this.assessmentIds),
            );
        }

        if (this.questionIds.length > 0) {
            await run(
                'student_responses (by question)',
                this.db.from('student_responses').delete().in('question_id', this.questionIds),
            );
        }

        if (this.userIds.length > 0) {
            await run('xp_events', this.db.from('xp_events').delete().in('user_id', this.userIds));
            await run(
                'recommendation_plans',
                this.db.from('recommendation_plans').delete().in('user_id', this.userIds),
            );
            await run(
                'assessments (by user)',
                this.db.from('assessments').delete().in('user_id', this.userIds),
            );
            await run(
                'category_progress',
                this.db.from('category_progress').delete().in('user_id', this.userIds),
            );
        }

        if (this.categoryIds.length > 0) {
            await run(
                'assessments (by category)',
                this.db.from('assessments').delete().in('category_id', this.categoryIds),
            );
        }

        if (this.questionIds.length > 0) {
            await run('answers', this.db.from('answers').delete().in('question_id', this.questionIds));
            await run('questions', this.db.from('questions').delete().in('question_id', this.questionIds));
        }

        if (this.userIds.length > 0) {
            await run('users', this.db.from('users').delete().in('user_id', this.userIds));
        }

        if (this.categoryIds.length > 0) {
            await run(
                'skill_categories',
                this.db.from('skill_categories').delete().in('category_id', this.categoryIds),
            );
        }

        if (problems.length > 0) {
            throw new Error(
                `Sandbox "${this.tag}" could not clean up after itself:\n  ${problems.join('\n  ')}\n\n` +
                    `Leftover rows are visible to every student in the test project. Categories ` +
                    `${this.categoryIds.join(', ') || '(none)'} and users ` +
                    `${this.userIds.join(', ') || '(none)'} may need deleting by hand.`,
            );
        }
    }
}
