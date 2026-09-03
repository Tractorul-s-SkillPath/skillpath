/**
 * Schema invariants — the bugs we never have to test for elsewhere (§4.1).
 *
 * Story: SP-003
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE MATTERS MORE THAN AN ORDINARY TEST
 *
 * There are no migrations in the repository. ARCHITECTURE §0 calls that "the
 * largest single gap in the project": the live schema was applied by hand in
 * the SQL editor, and `lib/supabase/database.types.ts` — hand-written — is the
 * only in-repo description of it. Nobody can recreate the database from a
 * clone.
 *
 * So this file is not checking that Postgres enforces constraints. It is the
 * repository's only executable record of WHICH constraints exist, asserted
 * against the database rather than described in a comment that cannot go stale
 * loudly. Every name below is the real one, and a failure here means the two
 * projects have drifted apart — which is exactly what the missing migration
 * makes likely.
 *
 * These are also the guarantees the application layer is allowed to stop
 * checking. `assessments_score_present` is why no service asks whether a
 * submitted run has a score.
 * ---------------------------------------------------------------------------
 *
 * Each assertion goes through a raw client rather than a repository: a
 * repository would translate the error, and the constraint NAME is the thing
 * worth pinning.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Sandbox, testClient, type TestClient } from '../helpers/supabase-test-client';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../lib/domain/constants';

let db: TestClient;
let sandbox: Sandbox;
let member: { userId: string };
let category: { categoryId: number };
let question: { questionId: number };

// -----------------------------------------------------------------------------
// Writing rows the TypeScript types refuse
// -----------------------------------------------------------------------------
//
// Most inserts below are INVALID ON PURPOSE — a missing column, a score of 101,
// an enum value that is not in the type. That is the whole subject of the file:
// it asserts what the DATABASE rejects, and a test that could only send
// type-valid payloads could never reach a constraint at all.
//
// The generated Insert types are also stricter than the schema in places, since
// database.types.ts is hand-written (ARCHITECTURE §0) — `skill_categories`
// requires a description the column defaults, `assessments` does not accept the
// `status` the column has.
//
// So this file writes through one narrow untyped seam rather than sprinkling
// casts over thirty call sites. Reads and deletes still go through the typed
// client: only the payload under test is untyped, and only here.

interface RawResult {
    data: Record<string, number> | null;
    error: { code?: string; message: string } | null;
}

interface RawInsert extends PromiseLike<RawResult> {
    select(columns: string): { single(): PromiseLike<RawResult> };
}

interface RawTable {
    insert(row: unknown): RawInsert;
    update(patch: unknown): { eq(column: string, value: unknown): PromiseLike<RawResult> };
}

function raw(table: string): RawTable {
    return (db as unknown as { from(t: string): RawTable }).from(table);
}

beforeAll(async () => {
    db = testClient();
    sandbox = new Sandbox(db, 'constraints');
    member = await sandbox.createUser();
    const bank = await sandbox.createCategoryWithBank(2);
    category = { categoryId: bank.categoryId };
    question = { questionId: bank.questions[0].questionId };
});

afterAll(async () => {
    await sandbox.destroy();
});

/** A submitted assessment needs all three of these or a different check fires. */
const submitted = (extra: Record<string, unknown> = {}) => ({
    user_id: member.userId,
    category_id: category.categoryId,
    requested_level: 'beginner' as const,
    status: 'submitted' as const,
    total_score: 50,
    submitted_at: new Date().toISOString(),
    ...extra,
});

describe('answers', () => {
    it('ALLOWS a second correct answer on one question', async () => {
        // SP-003 AC2 wanted this rejected, and `answers_one_correct_per_question`
        // did reject it. The index was dropped for multi-select questions, so
        // this test pins the CURRENT behaviour and is the thing that fails
        // loudly if somebody recreates the index — which would start rejecting
        // writes the admin form is allowed to make.
        const { data: q } = await raw('questions').insert({
                category_id: category.categoryId,
                text: `two-correct ${sandbox.name}`,
                difficulty: 'beginner',
            })
            .select('question_id')
            .single();

        const { error } = await raw('answers').insert([
            { question_id: q!.question_id, answer_text: 'A', is_correct: true, position: 1 },
            { question_id: q!.question_id, answer_text: 'B', is_correct: true, position: 2 },
        ]);

        expect(error).toBeNull();

        await db.from('answers').delete().eq('question_id', q!.question_id);
        await db.from('questions').delete().eq('question_id', q!.question_id);
    });

    it('rejects two options in the same position on one question', async () => {
        const { error } = await raw('answers').insert({
            question_id: question.questionId,
            answer_text: 'Duplicate slot',
            is_correct: false,
            position: 1,
        });

        // The reason question.repo.insertWithAnswers numbers its positions
        // explicitly: the column defaults to 0, so four unnumbered options are
        // four rows claiming slot 0.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('answers_position_unique');
    });
});

describe('assessments', () => {
    it('allows one in-progress run per (user, category) and refuses a second', async () => {
        const open = await raw('assessments').insert({
                user_id: member.userId,
                category_id: category.categoryId,
                requested_level: 'beginner',
                status: 'in_progress',
            })
            .select('assessment_id')
            .single();

        expect(open.error).toBeNull();

        const { error } = await raw('assessments').insert({
            user_id: member.userId,
            category_id: category.categoryId,
            requested_level: 'beginner',
            status: 'in_progress',
        });

        // What makes find-or-create safe: two tabs pressing Start cannot
        // produce two runs, so "resume" never has to choose between them.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('one_active_assessment_per_user_category');

        await db.from('assessments').delete().eq('assessment_id', open.data!.assessment_id);
    });

    it('allows a second in-progress run in a DIFFERENT category', async () => {
        // The index is partial and per-category, not per-user. A member may sit
        // several papers at once as long as they are different papers.
        const first = await raw('assessments').insert({
                user_id: member.userId,
                category_id: category.categoryId,
                requested_level: 'beginner',
                status: 'in_progress',
            })
            .select('assessment_id')
            .single();

        const second = await raw('assessments').insert({
                user_id: member.userId,
                category_id: GENERAL_KNOWLEDGE_CATEGORY_ID,
                requested_level: 'beginner',
                status: 'in_progress',
            })
            .select('assessment_id')
            .single();

        expect(second.error).toBeNull();

        await db
            .from('assessments')
            .delete()
            .in('assessment_id', [first.data!.assessment_id, second.data!.assessment_id]);
    });

    it("rejects 'submitted' with no score (SP-003 AC3)", async () => {
        const { error } = await raw('assessments').insert(submitted({ total_score: null }));

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('assessments_score_present');
    });

    it("rejects 'in_progress' WITH a score — the check is an equality", async () => {
        // Both directions, which is what makes the column trustworthy: a score
        // exists if and only if the run is submitted.
        const { error } = await raw('assessments').insert({
            user_id: member.userId,
            category_id: category.categoryId,
            requested_level: 'beginner',
            status: 'in_progress',
            total_score: 50,
        });

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('assessments_score_present');
    });

    it("rejects 'submitted' with no submitted_at", async () => {
        const { error } = await raw('assessments').insert(submitted({ submitted_at: null }));

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('assessments_submitted_at_present');
    });

    it.each([101, -1])('rejects a total_score of %i', async (score) => {
        const { error } = await raw('assessments').insert(submitted({ total_score: score }));

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('assessments_total_score_check');
    });

    it('rejects a total_score too large for the column, before the range check', async () => {
        // 1000 never reaches assessments_total_score_check: the column is a
        // narrow `numeric` and Postgres raises 22003 (numeric field overflow)
        // first. Worth its own case rather than folded into the row above,
        // because the two failures have different codes and a caller mapping
        // only 23514 would report this one as "something went wrong".
        const { error } = await raw('assessments').insert(submitted({ total_score: 1000 }));

        expect(error?.code).toBe('22003');
    });

    it.each([0, 50, 100])('accepts a total_score of %i', async (score) => {
        const { data, error } = await raw('assessments').insert(submitted({ total_score: score }))
            .select('assessment_id')
            .single();

        expect(error).toBeNull();

        await db.from('assessments').delete().eq('assessment_id', data!.assessment_id);
    });
});

describe('student_responses', () => {
    let assessmentId: number;

    beforeAll(async () => {
        const { data } = await raw('assessments').insert({
                user_id: member.userId,
                category_id: category.categoryId,
                requested_level: 'beginner',
                status: 'in_progress',
            })
            .select('assessment_id')
            .single();

        assessmentId = data!.assessment_id;

        await raw('student_responses').insert({ assessment_id: assessmentId, question_id: question.questionId, position: 1 });
    });

    afterAll(async () => {
        await db.from('student_responses').delete().eq('assessment_id', assessmentId);
        await db.from('assessments').delete().eq('assessment_id', assessmentId);
    });

    it('rejects the same question twice on one paper', async () => {
        const { error } = await raw('student_responses').insert({ assessment_id: assessmentId, question_id: question.questionId, position: 2 });

        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('student_responses_question_unique');
    });

    it('rejects two questions in the same position on one paper', async () => {
        const { data: other } = await raw('questions').insert({
                category_id: category.categoryId,
                text: `position clash ${sandbox.name}`,
                difficulty: 'beginner',
            })
            .select('question_id')
            .single();

        const { error } = await raw('student_responses').insert({ assessment_id: assessmentId, question_id: other!.question_id, position: 1 });

        // Position is how a member counts ("question 3 of 20") and how
        // lib/domain/baseline.ts keys its topic map. Two rows in slot 1 make
        // both meaningless.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('student_responses_position_unique');

        await db.from('questions').delete().eq('question_id', other!.question_id);
    });

    it('rejects a selected answer with no answered_at', async () => {
        const { data: other } = await raw('questions').insert({
                category_id: category.categoryId,
                text: `answered_at ${sandbox.name}`,
                difficulty: 'beginner',
            })
            .select('question_id')
            .single();

        const { data: answer } = await raw('answers').insert({
                question_id: other!.question_id,
                answer_text: 'Only option',
                is_correct: true,
                position: 1,
            })
            .select('answer_id')
            .single();

        const { error } = await raw('student_responses').insert({
            assessment_id: assessmentId,
            question_id: other!.question_id,
            position: 2,
            selected_answer_id: answer!.answer_id,
        });

        // The pair is the invariant: an answer without a timestamp cannot be
        // ordered against the time limit. response.repo.saveSelection always
        // sends both, and this is why it must.
        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('student_responses_answered_at_present');

        await db.from('answers').delete().eq('question_id', other!.question_id);
        await db.from('questions').delete().eq('question_id', other!.question_id);
    });
});

describe('category_progress', () => {
    it('rejects a duplicate (user_id, category_id)', async () => {
        await raw('category_progress').insert({
            user_id: member.userId,
            category_id: category.categoryId,
            current_level: 'beginner',
        });

        const { error } = await raw('category_progress').insert({
            user_id: member.userId,
            category_id: category.categoryId,
            current_level: 'advanced',
        });

        // SP-054 AC2: a second assessment updates the row, it does not add one.
        // It is also what profile.repo's upsert conflicts on.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('category_progress_unique');

        await db
            .from('category_progress')
            .delete()
            .eq('user_id', member.userId)
            .eq('category_id', category.categoryId);
    });
});

describe('skill_categories', () => {
    it.each([1, 61])('rejects a name of %i characters', async (length) => {
        const { error } = await raw('skill_categories').insert({ name: 'x'.repeat(length) });

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('skill_categories_name_check');
    });

    it.each([2, 60])('accepts a name of %i characters', async (length) => {
        const name = `${'y'.repeat(length - 1)}${length}`.slice(0, length);

        const { data, error } = await raw('skill_categories').insert({ name })
            .select('category_id')
            .single();

        expect(error).toBeNull();

        await db.from('skill_categories').delete().eq('category_id', data!.category_id);
    });

    it('rejects a duplicate name', async () => {
        const { data: existing } = await db
            .from('skill_categories')
            .select('name')
            .eq('category_id', category.categoryId)
            .single();

        const { error } = await raw('skill_categories').insert({ name: existing!.name });

        // SP-031 AC2 — what category.repo turns into a field error rather than
        // a 500.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('skill_categories_name_key');
    });

    it('REFUSES to delete a category that still has questions', async () => {
        const { error } = await db
            .from('skill_categories')
            .delete()
            .eq('category_id', category.categoryId);

        // `on delete restrict`. SP-032 makes deactivation the offered action
        // precisely because of this — refusing at the last moment with a
        // constraint error is not the same offering a delete.
        expect(error?.code).toBe('23503');
        expect(error?.message).toContain('questions_category_id_fkey');
    });
});

describe('users', () => {
    // ---------------------------------------------------------------------
    // NEITHER OF THESE CAN INSERT A `users` ROW ANY MORE, AND THAT IS THE
    // CONSTRAINT WORKING.
    //
    // `users.user_id` is `uuid references auth.users(id)` with no default, and
    // the `password` column is gone. So a profile row cannot be conjured — it
    // arrives when `on_auth_user_created` fires. Both tests below now go
    // through the auth admin API to get one, which is also what the code under
    // test does.
    // ---------------------------------------------------------------------
    it('rejects a duplicate email', async () => {
        const { data: existing } = await db
            .from('users')
            .select('email')
            .eq('user_id', member.userId)
            .single();

        // An UPDATE rather than an INSERT. The unique index is the same either
        // way, and this is the only way to aim a second row at an address that
        // is already taken now that every row's id has to come from an account.
        const other = await sandbox.createUser();

        const { error } = await db
            .from('users')
            .update({ email: existing!.email })
            .eq('user_id', other.userId);

        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('users_email_key');
    });

    it('cascades a deletion to the member’s assessments', async () => {
        // Deliberately NOT sandbox.createUser(): this test deletes the account
        // itself, and a sandbox that tried to delete it again in destroy()
        // would report a teardown failure for a row the test removed on
        // purpose.
        const { data: created, error: createError } = await db.auth.admin.createUser({
            email: `cascade-${sandbox.name}@skillpath.test`,
            password: 'sandbox-password-1234',
            email_confirm: true,
            user_metadata: { first_name: 'Doomed', last_name: `${sandbox.name}-cascade` },
        });

        expect(createError, 'could not create the doomed account').toBeNull();

        const doomed = { data: { user_id: created.user!.id } };

        await raw('assessments').insert({
            user_id: doomed.data!.user_id,
            category_id: category.categoryId,
            requested_level: 'beginner',
            status: 'in_progress',
        });

        // Delete the ACCOUNT, which is the deletion that actually happens in
        // production — a member removing themselves goes through auth, not
        // through a DELETE on a profile row. It exercises one more link than
        // the old version did: auth.users -> public.users -> assessments, and
        // a break anywhere along that chain leaves the count non-zero.
        const { error } = await db.auth.admin.deleteUser(doomed.data!.user_id);

        expect(error).toBeNull();

        const { count } = await db
            .from('assessments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', doomed.data!.user_id);

        expect(count).toBe(0);
    });
});

describe('recommendation_plans', () => {
    const item = (extra: Record<string, unknown> = {}) => ({
        user_id: member.userId,
        category_id: category.categoryId,
        topic_title: `Topic ${Math.random().toString(36).slice(2, 8)}`,
        priority: 1,
        ...extra,
    });

    it('rejects a one-character topic title', async () => {
        const { error } = await raw('recommendation_plans').insert(item({ topic_title: 'x' }));

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('recommendation_plans_topic_title_check');
    });

    it('rejects a priority below 1', async () => {
        const { error } = await raw('recommendation_plans').insert(item({ priority: 0 }));

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('recommendation_plans_priority_check');
    });

    it('does NOT cap priority at 3', async () => {
        // The check is a lower bound only. The plan generator emits 1-3 and the
        // page groups on those three, so a 4 would render in no group at all —
        // but that is the generator's contract, not the database's. Recorded
        // because the constraint name suggests a range and it is not one.
        const { data, error } = await raw('recommendation_plans').insert(item({ priority: 4 }))
            .select('recommendation_id')
            .single();

        expect(error).toBeNull();

        await db
            .from('recommendation_plans')
            .delete()
            .eq('recommendation_id', data!.recommendation_id);
    });

    it('rejects the same topic twice for one member and category', async () => {
        const first = await raw('recommendation_plans').insert(item({ topic_title: `Once only ${sandbox.name}` }))
            .select('recommendation_id')
            .single();

        expect(first.error).toBeNull();

        const { error } = await raw('recommendation_plans').insert(item({ topic_title: `Once only ${sandbox.name}`, priority: 2 }));

        // Regenerating a plan cannot stack duplicate advice on the same topic.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('recommendation_plans_topic_unique');

        await db
            .from('recommendation_plans')
            .delete()
            .eq('recommendation_id', first.data!.recommendation_id);
    });
});

describe('xp_events', () => {
    it('rejects an award that names nothing it was earned for', async () => {
        const { error } = await raw('xp_events').insert({
            user_id: member.userId,
            amount: 50,
            reason: 'assessment_submitted',
        });

        // The ledger is append-only, so a row with no provenance can never be
        // explained afterwards — "why do I have this much XP" would have a gap
        // in it with no way to fill one in.
        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('xp_events_provenance');
    });

    it('rejects a badge code that is not a real one', async () => {
        const { error } = await raw('xp_events').insert({
            user_id: member.userId,
            amount: 25,
            reason: 'badge_earned',
            code: 'a',
        });

        expect(error?.code).toBe('23514');
        expect(error?.message).toContain('xp_events_code_check');
    });

    it('rejects the same badge twice for one member', async () => {
        const first = await raw('xp_events').insert({
                user_id: member.userId,
                amount: 25,
                reason: 'badge_earned',
                code: 'first_assessment',
            })
            .select('xp_event_id')
            .single();

        expect(first.error).toBeNull();

        const { error } = await raw('xp_events').insert({
            user_id: member.userId,
            amount: 25,
            reason: 'badge_earned',
            code: 'first_assessment',
        });

        // `xp_events_badge_once` — the PARTIAL unique index that xp.repo's
        // long comment is about. It is why awardBadges reads before it writes
        // instead of using an upsert.
        expect(error?.code).toBe('23505');
        expect(error?.message).toContain('xp_events_badge_once');

        await db.from('xp_events').delete().eq('xp_event_id', first.data!.xp_event_id);
    });
});

describe('enums', () => {
    // Every one of these is a real Postgres enum, not a CHECK on text —
    // database.types.ts says so at the top and this is what makes that true.
    // The docblock this file replaced said there were six; there are eight.
    // Each case INSERTS its own row rather than updating an ambient one. An
    // UPDATE matching zero rows succeeds, so a case whose fixture had been
    // cleaned up by an earlier block would pass having asserted nothing — which
    // is exactly what happened to assessment_status and xp_reason the first
    // time this file ran.
    const cases: Array<[string, () => PromiseLike<{ error: { code?: string } | null }>]> = [
        // These two UPDATE where the rest INSERT, and the note above about
        // "each case inserts its own row" does not apply to them: a `users` row
        // cannot be inserted any more (its id has to come from auth.users), so
        // there is nothing to insert into. The row being updated is the
        // sandbox's own member, and the update is rejected by the enum before
        // it can change anything — so the concern the note guards against, a
        // zero-row UPDATE passing while asserting nothing, does not arise: a
        // failure here is 22P02, not an empty result.
        ['user_role', () => raw('users').update({ role: 'wizard' }).eq('user_id', member.userId)],
        ['user_status', () => raw('users').update({ status: 'wizard' }).eq('user_id', member.userId)],
        ['skill_level', () => raw('questions').insert({ category_id: category.categoryId, text: `enum skill ${sandbox.name}`, difficulty: 'wizard' })],
        ['content_status', () => raw('questions').insert({ category_id: category.categoryId, text: `enum content ${sandbox.name}`, difficulty: 'beginner', status: 'wizard' })],
        ['question_source', () => raw('questions').insert({ category_id: category.categoryId, text: `enum source ${sandbox.name}`, difficulty: 'beginner', source: 'wizard' })],
        ['assessment_status', () => raw('assessments').insert({ user_id: member.userId, category_id: category.categoryId, requested_level: 'beginner', status: 'wizard' })],
        ['plan_status', () => raw('recommendation_plans').insert({ user_id: member.userId, category_id: category.categoryId, topic_title: `enum plan ${sandbox.name}`, priority: 1, progress_status: 'wizard' })],
        ['xp_reason', () => raw('xp_events').insert({ user_id: member.userId, amount: 1, reason: 'wizard', code: 'first_assessment' })],
    ];

    it.each(cases)('%s rejects a value outside the type', async (_name, run) => {
        const { error } = await run();

        expect(error?.code).toBe('22P02');
    });

    it("plan_status uses underscores, not the old spaced spelling", async () => {
        // The old hand-made schema used ('not started', 'in progress',
        // 'completed') WITH SPACES, and every layer carried a comment warning
        // about it. If a project were ever rebuilt from that version, this is
        // the test that says so rather than letting a status silently fail to
        // save.
        const { data: plan } = await raw('recommendation_plans').insert({
                user_id: member.userId,
                category_id: category.categoryId,
                topic_title: `Underscores ${sandbox.name}`,
                priority: 1,
            })
            .select('recommendation_id, progress_status')
            .single();

        expect(plan!.progress_status).toBe('not_started');

        const spaced = await raw('recommendation_plans').update({ progress_status: 'in progress' })
            .eq('recommendation_id', plan!.recommendation_id);

        expect(spaced.error?.code).toBe('22P02');

        const underscored = await raw('recommendation_plans').update({ progress_status: 'in_progress' })
            .eq('recommendation_id', plan!.recommendation_id);

        expect(underscored.error).toBeNull();

        await db
            .from('recommendation_plans')
            .delete()
            .eq('recommendation_id', plan!.recommendation_id);
    });
});
