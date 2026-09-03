/**
 * assessment.repo — against the real test database.
 *
 * Stories: SP-020, SP-040, SP-041, SP-042, SP-050, SP-053
 *
 * The run lifecycle, end to end, including `grade()`.
 *
 * `grade()` is the one this folder is really for. It is an RPC into
 * `grade_assessment()`, which is SECURITY DEFINER SQL holding the answer key —
 * so `grading.service.test.ts` can only assert the RPC is *called*, and its
 * fake returns whatever it is handed. Nothing in `npm test` can tell a correct
 * score from a wrong one. The tests below answer a known 3 of 5 and pin 60
 * exactly, then check that the `is_correct` snapshots agree with the number:
 * two writes of the same function, which must not disagree.
 *
 * `createWithResponses` is the other reason: two requests pretending to be a
 * transaction, with a hand-rolled rollback when the second fails.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as responseRepo from '../../../lib/repositories/response.repo';
import {
    Sandbox,
    testClient,
    type SandboxQuestion,
    type TestClient,
} from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'asm-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

/** A member, a category with a bank, and an open run over the whole bank. */
async function anOpenRun(bankSize = 5) {
    const member = await sandbox.createUser();
    const category = await sandbox.createCategoryWithBank(bankSize);

    const created = await assessmentRepo.createWithResponses(db, {
        userId: member.userId,
        categoryId: category.categoryId,
        requestedLevel: 'beginner',
        timeLimitSeconds: 600,
        questionIds: category.questions.map((q) => q.questionId),
    });

    if (!created.ok) throw new Error(`could not open a run: ${created.error.message}`);

    return { member, category, assessmentId: created.value, questions: category.questions };
}

/** Answers the paper: the first `correct` questions right, the rest wrong. */
async function answer(assessmentId: number, questions: SandboxQuestion[], correct: number) {
    for (const [index, question] of questions.entries()) {
        const answerId =
            index < correct ? question.correctAnswerId : question.wrongAnswerIds[0];

        const saved = await responseRepo.saveSelection(
            db,
            assessmentId,
            question.questionId,
            answerId,
        );

        if (!saved.ok) throw new Error(`could not save an answer: ${saved.error.message}`);
    }
}

describe('createWithResponses', () => {
    it('pre-creates one unanswered response row per question, numbered from 1', async () => {
        // D2: the pre-created row IS the unanswered state, which is what makes
        // an assessment survive a refresh without any localStorage.
        const run = await anOpenRun(3);

        const { data } = await db
            .from('student_responses')
            .select('position, selected_answer_id, answered_at')
            .eq('assessment_id', run.assessmentId)
            .order('position');

        expect(data?.map((r) => r.position)).toEqual([1, 2, 3]);
        expect(data?.every((r) => r.selected_answer_id === null)).toBe(true);
        expect(data?.every((r) => r.answered_at === null)).toBe(true);
    });

    it('starts the clock at creation', async () => {
        // remainingSeconds() is measured from started_at on both sides, so a
        // null here is an un-expiring paper.
        const run = await anOpenRun(2);

        const { data } = await db
            .from('assessments')
            .select('started_at, time_limit_seconds, status')
            .eq('assessment_id', run.assessmentId)
            .single();

        expect(data?.started_at).not.toBeNull();
        expect(data?.time_limit_seconds).toBe(600);
        expect(data?.status).toBe('in_progress');
    });

    it('removes the assessment again when its response rows fail', async () => {
        // The rollback. A question id that does not exist fails the second
        // request on a foreign key, after the assessment has committed — and an
        // in-progress run with no response rows renders as a blank paper.
        const member = await sandbox.createUser();
        const category = await sandbox.createCategoryWithBank(1);

        const result = await assessmentRepo.createWithResponses(db, {
            userId: member.userId,
            categoryId: category.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: [category.questions[0].questionId, -1],
        });

        expect(result.ok).toBe(false);

        const open = await assessmentRepo.listInProgress(db, member.userId);

        expect(open.ok).toBe(true);
        if (!open.ok) return;

        expect(open.value.size).toBe(0);
    });

    it('refuses a second open run in the same category', async () => {
        // one_active_assessment_per_user_category. This is what makes
        // find-or-create safe: two tabs pressing Start cannot produce two runs,
        // so "resume" never has to choose between them.
        const run = await anOpenRun(2);

        const second = await assessmentRepo.createWithResponses(db, {
            userId: run.member.userId,
            categoryId: run.category.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: run.questions.map((q) => q.questionId),
        });

        expect(second.ok).toBe(false);
        if (second.ok) return;

        expect(second.error.code).toBe('conflict');
    });
});

describe('findOwn', () => {
    it("finds the member's own run", async () => {
        const run = await anOpenRun(1);

        const result = await assessmentRepo.findOwn(db, run.member.userId, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value?.assessment_id).toBe(run.assessmentId);
    });

    it("returns null for another member's run — the user_id clause IS the 404", async () => {
        // With no RLS underneath (ARCHITECTURE §0), this `.eq('user_id', …)` is
        // the only thing between one member and another's paper. SP-053's 404
        // is this clause, not an `if` in a page.
        const run = await anOpenRun(1);
        const stranger = await sandbox.createUser();

        const result = await assessmentRepo.findOwn(db, stranger.userId, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeNull();
    });
});

describe('findByStatus and listInProgress', () => {
    it('finds an open run and, after grading, a submitted one', async () => {
        const run = await anOpenRun(2);

        const open = await assessmentRepo.findByStatus(
            db,
            run.member.userId,
            run.category.categoryId,
            'in_progress',
        );
        expect(open.ok && open.value?.assessment_id).toBe(run.assessmentId);

        const notYet = await assessmentRepo.findByStatus(
            db,
            run.member.userId,
            run.category.categoryId,
            'submitted',
        );
        expect(notYet.ok && notYet.value).toBeNull();

        await answer(run.assessmentId, run.questions, 2);
        expect((await assessmentRepo.grade(db, run.assessmentId)).ok).toBe(true);

        const submitted = await assessmentRepo.findByStatus(
            db,
            run.member.userId,
            run.category.categoryId,
            'submitted',
        );
        expect(submitted.ok && submitted.value?.assessment_id).toBe(run.assessmentId);

        // And the open run is gone, which is what lets the member start another.
        const stillOpen = await assessmentRepo.findByStatus(
            db,
            run.member.userId,
            run.category.categoryId,
            'in_progress',
        );
        expect(stillOpen.ok && stillOpen.value).toBeNull();
    });

    it('maps every open run by category', async () => {
        const member = await sandbox.createUser();
        const first = await sandbox.createCategoryWithBank(1);
        const second = await sandbox.createCategoryWithBank(1);

        for (const category of [first, second]) {
            const created = await assessmentRepo.createWithResponses(db, {
                userId: member.userId,
                categoryId: category.categoryId,
                requestedLevel: 'beginner',
                timeLimitSeconds: 600,
                questionIds: category.questions.map((q) => q.questionId),
            });
            expect(created.ok).toBe(true);
        }

        const result = await assessmentRepo.listInProgress(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.size).toBe(2);
        expect(result.value.has(first.categoryId)).toBe(true);
        expect(result.value.has(second.categoryId)).toBe(true);
    });
});

describe('listByUser', () => {
    it('returns the history newest first, with the category name resolved', async () => {
        const run = await anOpenRun(1);

        const result = await assessmentRepo.listByUser(db, run.member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toHaveLength(1);
        expect(result.value[0].categoryName).toBe(run.category.name);
    });

    it('honours the limit', async () => {
        const member = await sandbox.createUser();

        for (let i = 0; i < 3; i += 1) {
            const category = await sandbox.createCategoryWithBank(1);
            await assessmentRepo.createWithResponses(db, {
                userId: member.userId,
                categoryId: category.categoryId,
                requestedLevel: 'beginner',
                timeLimitSeconds: 600,
                questionIds: category.questions.map((q) => q.questionId),
            });
        }

        const result = await assessmentRepo.listByUser(db, member.userId, 2);

        expect(result.ok && result.value).toHaveLength(2);
    });
});

describe('grade', () => {
    it('scores a known 3 of 5 as exactly 60', async () => {
        // The assertion nothing in `npm test` can make. If grade_assessment()
        // ever counts a wrong answer as right, or divides by the wrong total,
        // this is where it shows.
        const run = await anOpenRun(5);
        await answer(run.assessmentId, run.questions, 3);

        const result = await assessmentRepo.grade(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(60);
    });

    it('writes a score the per-response snapshots agree with', async () => {
        // Two writes of the same function. The score comes from
        // assessments.total_score and the bands on the results page come from
        // the is_correct snapshots — they are read separately and must not
        // disagree, or a member sees "60%" above four ticks out of five.
        const run = await anOpenRun(5);
        await answer(run.assessmentId, run.questions, 3);
        await assessmentRepo.grade(db, run.assessmentId);

        const { data: assessment } = await db
            .from('assessments')
            .select('status, total_score, submitted_at')
            .eq('assessment_id', run.assessmentId)
            .single();

        const { data: responses } = await db
            .from('student_responses')
            .select('is_correct')
            .eq('assessment_id', run.assessmentId);

        expect(assessment?.status).toBe('submitted');
        expect(Number(assessment?.total_score)).toBe(60);
        expect(assessment?.submitted_at).not.toBeNull();

        expect(responses?.filter((r) => r.is_correct === true)).toHaveLength(3);
        expect(responses?.filter((r) => r.is_correct === false)).toHaveLength(2);
    });

    it('scores an untouched paper as 0 rather than failing', async () => {
        const run = await anOpenRun(4);

        const result = await assessmentRepo.grade(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(0);
    });

    it('scores a perfect paper as 100', async () => {
        const run = await anOpenRun(4);
        await answer(run.assessmentId, run.questions, 4);

        const result = await assessmentRepo.grade(db, run.assessmentId);

        expect(result.ok && result.value).toBe(100);
    });

    it('refuses to grade the same run twice', async () => {
        // The run is graded and paid by the time this could happen; grading it
        // again would award the XP a second time.
        const run = await anOpenRun(2);
        await answer(run.assessmentId, run.questions, 1);

        expect((await assessmentRepo.grade(db, run.assessmentId)).ok).toBe(true);

        const second = await assessmentRepo.grade(db, run.assessmentId);

        expect(second.ok).toBe(false);
    });

    it('reports a run that does not exist as a failure, not as a score of 0', async () => {
        const result = await assessmentRepo.grade(db, -1);

        expect(result.ok).toBe(false);
    });

    it('records the level and the score on category_progress, by trigger', async () => {
        // Written by the database, not by any repository — so nothing in the
        // TypeScript suite can see it happen. profile.repo.listInterests reads
        // this row for every member's profile page.
        const run = await anOpenRun(4);
        await answer(run.assessmentId, run.questions, 4);
        await assessmentRepo.grade(db, run.assessmentId);

        const { data } = await db
            .from('category_progress')
            .select('current_level, last_score, last_assessed_at')
            .eq('user_id', run.member.userId)
            .eq('category_id', run.category.categoryId)
            .single();

        expect(data).not.toBeNull();
        expect(Number(data?.last_score)).toBe(100);
        expect(data?.last_assessed_at).not.toBeNull();
    });

    it('awards the submission XP once, by trigger', async () => {
        const run = await anOpenRun(2);
        await answer(run.assessmentId, run.questions, 1);
        await assessmentRepo.grade(db, run.assessmentId);

        const { data } = await db
            .from('xp_events')
            .select('amount, reason, assessment_id')
            .eq('user_id', run.member.userId);

        const submissions = data?.filter((e) => e.reason === 'assessment_submitted') ?? [];

        expect(submissions).toHaveLength(1);
        expect(submissions[0].assessment_id).toBe(run.assessmentId);
    });
});
