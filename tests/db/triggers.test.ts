/**
 * The triggers and functions that write rows nothing in TypeScript writes.
 *
 * Stories: SP-013, SP-054, SP-101 … SP-105, SP-118
 *
 * ---------------------------------------------------------------------------
 * THIS FILE DOES NOT TEST WHAT ITS DOCBLOCK USED TO DESCRIBE, AND CANNOT.
 *
 * The spec here was written for a Supabase Auth schema: "creating an auth user
 * creates exactly one profiles row", "first_name from raw_user_meta_data lands
 * in the profile", "a student PATCHing their own row with role='admin' is
 * silently kept as student". None of that exists. There is no `auth.users`, no
 * `profiles` table and no role-preservation trigger — the project has a plain
 * `users` table and a signed cookie of its own (ARCHITECTURE §0, deviation D1
 * never applied). Those cases are not failing; they have nothing to run against.
 *
 * What DOES exist is a different and equally untested set of triggers, all
 * hanging off grading and plan completion. They are the rows no repository
 * writes, so nothing in `npm test` can see them at all. They are tested here.
 * ---------------------------------------------------------------------------
 *
 * The most valuable case below is the one `lib/domain/constants.ts` asks for by
 * name. The XP amounts and level thresholds exist TWICE — in that file and in
 * SQL — and its header says:
 *
 *   "NOTHING ENFORCES RULE 2 TODAY. […] a migration that changes
 *    xp_per_assessment() to 60 while this file still says 50 will compile,
 *    deploy, and show every member a number they were not awarded. The guard is
 *    a five-line test […] worth writing the day tests arrive."
 *
 * It suggested reading the migration and diffing the constants. There is no
 * migration in the repository to read (§0), so this does it the other way
 * round: grade real papers at known scores and compare what the SQL actually
 * wrote against what the TypeScript constants claim. That checks the authority
 * rather than a file that is supposed to mirror it.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../lib/repositories/assessment.repo';
import * as planRepo from '../../lib/repositories/plan.repo';
import * as responseRepo from '../../lib/repositories/response.repo';
import { estimateLevel } from '../../lib/domain/levels';
import {
    XP_PER_ASSESSMENT,
    XP_PER_PLAN_ITEM,
    XP_PER_SCORE_POINT,
} from '../../lib/domain/constants';
import { Sandbox, testClient, type TestClient } from '../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'triggers');
});

afterAll(async () => {
    await sandbox.destroy();
});

/**
 * Sits a ten-question paper, answering `correct` of them, and grades it.
 *
 * Ten questions so a score lands exactly on a threshold: 5/10 is 50 and 8/10 is
 * 80, which are the two boundaries level_for_score() turns on.
 */
async function sitAPaper(correct: number, existing?: { userId: string; categoryId: number }) {
    const member = existing ?? { userId: (await sandbox.createUser()).userId, categoryId: 0 };

    const category = existing
        ? { categoryId: existing.categoryId, questions: [] as never[] }
        : await sandbox.createCategoryWithBank(10);

    const categoryId = existing ? existing.categoryId : category.categoryId;

    const questions = existing
        ? (
              await db
                  .from('questions')
                  .select('question_id, answers(answer_id, is_correct)')
                  .eq('category_id', categoryId)
                  .order('question_id')
          ).data!.map((q) => ({
              questionId: q.question_id,
              correctAnswerId: q.answers.find((a) => a.is_correct)!.answer_id,
              wrongAnswerIds: q.answers.filter((a) => !a.is_correct).map((a) => a.answer_id),
          }))
        : category.questions;

    const created = await assessmentRepo.createWithResponses(db, {
        userId: member.userId,
        categoryId,
        requestedLevel: 'beginner',
        timeLimitSeconds: 600,
        questionIds: questions.map((q) => q.questionId),
    });

    if (!created.ok) throw new Error(`could not open a run: ${created.error.message}`);

    for (const [index, question] of questions.entries()) {
        await responseRepo.saveSelection(
            db,
            created.value,
            question.questionId,
            index < correct ? question.correctAnswerId : question.wrongAnswerIds[0],
        );
    }

    const graded = await assessmentRepo.grade(db, created.value);
    if (!graded.ok) throw new Error(`could not grade: ${graded.error.message}`);

    return {
        userId: member.userId,
        categoryId,
        assessmentId: created.value,
        score: graded.value,
    };
}

describe('grading writes category_progress', () => {
    it('creates the row on a first assessment', async () => {
        // SP-054. No repository writes this table — progress.repo.ts is still
        // comment-only — so the row exists because the database made it.
        const run = await sitAPaper(7);

        const { data } = await db
            .from('category_progress')
            .select('current_level, last_score, last_assessed_at')
            .eq('user_id', run.userId)
            .eq('category_id', run.categoryId)
            .single();

        expect(data).not.toBeNull();
        expect(Number(data!.last_score)).toBe(70);
        expect(data!.last_assessed_at).not.toBeNull();
    });

    it('UPDATES the row on a second assessment rather than adding one', async () => {
        // SP-054 AC2, and the reason category_progress_unique exists. Two rows
        // would make "what level am I in this category" ambiguous, and
        // listInterests would render the category twice.
        const first = await sitAPaper(3);
        const second = await sitAPaper(9, { userId: first.userId, categoryId: first.categoryId });

        expect(second.score).toBe(90);

        const { data, count } = await db
            .from('category_progress')
            .select('last_score', { count: 'exact' })
            .eq('user_id', first.userId)
            .eq('category_id', first.categoryId);

        expect(count).toBe(1);
        expect(Number(data![0].last_score)).toBe(90);
    });
});

describe('the level thresholds are duplicated in SQL and TypeScript (SP-118)', () => {
    // The check constants.ts asks for. `level_for_score()` in SQL writes
    // category_progress.current_level; `estimateLevel()` in TypeScript decides
    // what the profile and the results page print. Two answers to "what level
    // am I" is the failure lib/domain/levels.ts says it exists to prevent, and
    // until now nothing compared them.
    //
    // 5/10 and 8/10 are the boundaries themselves, which is where a `>` written
    // for a `>=` on either side shows up.
    it.each([
        [0, 0],
        [4, 40],
        [5, 50],
        [7, 70],
        [8, 80],
        [10, 100],
    ])('a %i/10 paper scores %i%% and both sides agree on the level', async (correct, score) => {
        const run = await sitAPaper(correct);

        expect(run.score).toBe(score);

        const { data } = await db
            .from('category_progress')
            .select('current_level')
            .eq('user_id', run.userId)
            .eq('category_id', run.categoryId)
            .single();

        expect(data!.current_level).toBe(estimateLevel(score));
    });
});

describe('grading awards XP', () => {
    it('pays a FLAT award — the score points the constants promise are never awarded', async () => {
        // ---------------------------------------------------------------
        // THE DIVERGENCE constants.ts PREDICTED. This test found it.
        //
        // TypeScript says the award is XP_PER_ASSESSMENT (50) plus
        // XP_PER_SCORE_POINT (1) per percentage point. The SQL pays 50 and
        // stops: a 70% paper and a 0% paper are both worth exactly 50 XP, so
        // `xp_per_score_point()` is either absent or returns 0 in this project.
        // Nothing was comparing them, which is precisely what the header of
        // lib/domain/constants.ts says would happen:
        //
        //   "a migration that changes xp_per_assessment() to 60 while this file
        //    still says 50 will compile, deploy, and show every member a number
        //    they were not awarded."
        //
        // It is user-visible today, not theoretical. lib/domain/derived.ts
        // builds the daily quest cards from these constants — "Sharp today"
        // advertises `70 * XP_PER_SCORE_POINT` = 70 XP for scoring 70%, and a
        // member who does it is awarded nothing beyond the flat 50 they would
        // have had for any score at all.
        //
        // Pinned as-is rather than fixed, because the fix is a product
        // decision and it is not this file's to make: either the SQL starts
        // paying per point, or XP_PER_SCORE_POINT and the quest that reads it
        // come out of the TypeScript. Whichever is chosen, this test goes red
        // and should be rewritten to the new truth — not deleted.
        // ---------------------------------------------------------------
        const scored = await sitAPaper(7);
        expect(scored.score).toBe(70);

        const { data } = await db
            .from('xp_events')
            .select('amount, reason, assessment_id')
            .eq('user_id', scored.userId)
            .eq('reason', 'assessment_submitted');

        expect(data).toHaveLength(1);
        expect(data![0].assessment_id).toBe(scored.assessmentId);

        // What the database actually does:
        expect(data![0].amount).toBe(XP_PER_ASSESSMENT);

        // What the constants claim it does. Kept as an explicit statement of
        // the gap, so the size of it is on the record rather than implied.
        const advertised = XP_PER_ASSESSMENT + scored.score * XP_PER_SCORE_POINT;
        expect(advertised).toBe(120);
        expect(data![0].amount).not.toBe(advertised);
    });

    it('pays the flat award and nothing more for a paper scoring zero', async () => {
        const run = await sitAPaper(0);

        const { data } = await db
            .from('xp_events')
            .select('amount')
            .eq('user_id', run.userId)
            .eq('reason', 'assessment_submitted');

        expect(data![0].amount).toBe(XP_PER_ASSESSMENT);
    });

    it('pays once per submission, not once per grading attempt', async () => {
        const run = await sitAPaper(5);

        // The second grading is refused outright, which is what stops a retry
        // paying twice.
        const again = await assessmentRepo.grade(db, run.assessmentId);
        expect(again.ok).toBe(false);

        const { count } = await db
            .from('xp_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', run.userId)
            .eq('reason', 'assessment_submitted');

        expect(count).toBe(1);
    });
});

describe('grading snapshots each response', () => {
    it('writes an is_correct verdict per row that agrees with the total', async () => {
        // Two writes of one function. The percentage comes from
        // assessments.total_score and the per-band breakdown on the results
        // page comes from these snapshots — read separately, so they must not
        // disagree or a member sees "70%" above six ticks out of ten.
        const run = await sitAPaper(7);

        const { data } = await db
            .from('student_responses')
            .select('is_correct')
            .eq('assessment_id', run.assessmentId);

        expect(data!.filter((r) => r.is_correct === true)).toHaveLength(7);
        expect(data!.filter((r) => r.is_correct === false)).toHaveLength(3);
        expect(data!.filter((r) => r.is_correct === null)).toHaveLength(0);
    });

    it('closes the run and stamps submitted_at', async () => {
        const run = await sitAPaper(5);

        const { data } = await db
            .from('assessments')
            .select('status, submitted_at, total_score')
            .eq('assessment_id', run.assessmentId)
            .single();

        expect(data!.status).toBe('submitted');
        expect(data!.submitted_at).not.toBeNull();
        expect(Number(data!.total_score)).toBe(50);
    });
});

describe('completing a plan item', () => {
    async function aPlanItem() {
        const run = await sitAPaper(3);

        const written = await planRepo.insertMany(db, run.userId, run.categoryId, run.assessmentId, [
            { topicTitle: `Trigger topic ${sandbox.name}`, description: 'Study it.', priority: 1 },
        ]);

        if (!written.ok) throw new Error('could not write a plan');

        const listed = await planRepo.listByUser(db, run.userId);
        if (!listed.ok) throw new Error('could not read the plan');

        return { userId: run.userId, item: listed.value[0] };
    }

    it('stamps completed_at, a column no repository sends', async () => {
        const { userId, item } = await aPlanItem();

        await planRepo.setStatus(db, userId, item.recommendationId, 'completed');

        const { data } = await db
            .from('recommendation_plans')
            .select('completed_at')
            .eq('recommendation_id', item.recommendationId)
            .single();

        expect(data!.completed_at).not.toBeNull();
    });

    it('clears completed_at when the item is re-opened', async () => {
        const { userId, item } = await aPlanItem();

        await planRepo.setStatus(db, userId, item.recommendationId, 'completed');
        await planRepo.setStatus(db, userId, item.recommendationId, 'not_started');

        const { data } = await db
            .from('recommendation_plans')
            .select('completed_at')
            .eq('recommendation_id', item.recommendationId)
            .single();

        expect(data!.completed_at).toBeNull();
    });

    it('pays XP_PER_PLAN_ITEM, once, however many times it is re-ticked', async () => {
        const { userId, item } = await aPlanItem();

        for (let i = 0; i < 3; i += 1) {
            await planRepo.setStatus(db, userId, item.recommendationId, 'completed');
            await planRepo.setStatus(db, userId, item.recommendationId, 'not_started');
        }
        await planRepo.setStatus(db, userId, item.recommendationId, 'completed');

        const { data } = await db
            .from('xp_events')
            .select('amount')
            .eq('user_id', userId)
            .eq('reason', 'plan_item_completed');

        // A member with a plan and a patient finger would otherwise have
        // unbounded XP. `xp_events_plan_item_once` is what stops it.
        expect(data).toHaveLength(1);
        expect(data![0].amount).toBe(XP_PER_PLAN_ITEM);
    });

    it('pays nothing for moving an item to in_progress', async () => {
        const { userId, item } = await aPlanItem();

        await planRepo.setStatus(db, userId, item.recommendationId, 'in_progress');

        const { count } = await db
            .from('xp_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('reason', 'plan_item_completed');

        expect(count).toBe(0);
    });
});

describe('updated_at', () => {
    it('is maintained on update without anybody sending it', async () => {
        const member = await sandbox.createUser();

        const { data: before } = await db
            .from('users')
            .select('updated_at')
            .eq('user_id', member.userId)
            .single();

        await new Promise((resolve) => setTimeout(resolve, 1100));

        await db.from('users').update({ first_name: 'Renamed' }).eq('user_id', member.userId);

        const { data: after } = await db
            .from('users')
            .select('updated_at')
            .eq('user_id', member.userId)
            .single();

        expect(after!.updated_at).not.toBe(before!.updated_at);
        expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
            new Date(before!.updated_at).getTime(),
        );
    });
});
