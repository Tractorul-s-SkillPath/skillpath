/**
 * response.repo — against the real test database.
 *
 * Stories: SP-038, SP-043, SP-044, SP-046, SP-053
 *
 * TWO READS, TWO SHAPES, ONE RULE — and only a real query can tell them apart.
 * `listForRun` names the answer columns it wants so `is_correct` never enters
 * the payload; `listForReview` embeds the whole answers row, key included. A
 * fake returns whatever object the test wrote, so under `npm test` the two are
 * indistinguishable and the rule the file header states is unenforced.
 *
 * The header says: do not "simplify" the two selects into one. This file is
 * what makes that instruction cost something to ignore.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as responseRepo from '../../../lib/repositories/response.repo';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'resp-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

async function anOpenRun(bankSize = 4) {
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

describe('listForRun', () => {
    it('never carries the answer key', async () => {
        // SP-038, and the assertion that only a real select can make. Every
        // option that reaches the run screen must be exactly {answerId, text}:
        // an extra key here is the answer key in the RSC stream and the network
        // tab, where a student can read it before answering.
        const run = await anOpenRun();

        const result = await responseRepo.listForRun(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        for (const question of result.value) {
            for (const option of question.options) {
                expect(Object.keys(option).sort()).toEqual(['answerId', 'text']);
            }
        }

        // Belt and braces on the serialised payload, because that is the form
        // it actually travels in.
        const payload = JSON.stringify(result.value);
        expect(payload).not.toContain('is_correct');
        expect(payload).not.toContain('isCorrect');
    });

    it('returns the paper in position order', async () => {
        // Ordering by position is what makes a refresh reproduce the same paper
        // (SP-044). Without it the order is whatever the planner returns, which
        // is stable right up until it is not.
        const run = await anOpenRun(5);

        const result = await responseRepo.listForRun(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((q) => q.position)).toEqual([1, 2, 3, 4, 5]);
    });

    it('shuffles the options per assessment but identically on every read', async () => {
        // A refresh must not reorder the radios under the member's cursor.
        const run = await anOpenRun(4);

        const first = await responseRepo.listForRun(db, run.assessmentId);
        const second = await responseRepo.listForRun(db, run.assessmentId);

        expect(first.ok && second.ok).toBe(true);
        if (!first.ok || !second.ok) return;

        expect(first.value.map((q) => q.options.map((o) => o.answerId))).toEqual(
            second.value.map((q) => q.options.map((o) => o.answerId)),
        );
    });

    it('gives every question all four options', async () => {
        const run = await anOpenRun(3);

        const result = await responseRepo.listForRun(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        for (const question of result.value) {
            expect(question.options).toHaveLength(4);
            expect(question.text).not.toBe('');
        }
    });

    it('reports the current selection, and null before one is made', async () => {
        const run = await anOpenRun(2);

        const before = await responseRepo.listForRun(db, run.assessmentId);
        expect(before.ok && before.value.every((q) => q.selectedAnswerId === null)).toBe(true);

        const target = run.questions[0];
        await responseRepo.saveSelection(
            db,
            run.assessmentId,
            target.questionId,
            target.correctAnswerId,
        );

        const after = await responseRepo.listForRun(db, run.assessmentId);
        expect(after.ok).toBe(true);
        if (!after.ok) return;

        const row = after.value.find((q) => q.questionId === target.questionId);
        expect(row?.selectedAnswerId).toBe(target.correctAnswerId);
    });

    it('returns an empty list for a run that does not exist', async () => {
        const result = await responseRepo.listForRun(db, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual([]);
    });
});

describe('listForReview', () => {
    it('DOES carry the key — this is the graded paper', async () => {
        // The positive half of the SP-038 pair. "The payload has no answer key"
        // is equally true of an error and an empty list, so it means something
        // only next to a read that is supposed to have one.
        const run = await anOpenRun(3);

        for (const question of run.questions) {
            await responseRepo.saveSelection(
                db,
                run.assessmentId,
                question.questionId,
                question.correctAnswerId,
            );
        }

        await assessmentRepo.grade(db, run.assessmentId);

        const result = await responseRepo.listForReview(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toHaveLength(3);

        for (const item of result.value) {
            expect(item.correctAnswerId).not.toBeNull();
            expect(item.isCorrect).toBe(true);
            expect(item.selectedAnswerId).toBe(item.correctAnswerId);
        }
    });

    it('marks a wrong answer wrong and still names the right one', async () => {
        const run = await anOpenRun(2);

        await responseRepo.saveSelection(
            db,
            run.assessmentId,
            run.questions[0].questionId,
            run.questions[0].correctAnswerId,
        );
        await responseRepo.saveSelection(
            db,
            run.assessmentId,
            run.questions[1].questionId,
            run.questions[1].wrongAnswerIds[0],
        );

        await assessmentRepo.grade(db, run.assessmentId);

        const result = await responseRepo.listForReview(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const wrong = result.value.find((i) => i.position === 2);

        expect(wrong?.isCorrect).toBe(false);
        expect(wrong?.selectedAnswerId).toBe(run.questions[1].wrongAnswerIds[0]);
        expect(wrong?.correctAnswerId).toBe(run.questions[1].correctAnswerId);
    });

    it('carries the topic and advice the plan is built from', async () => {
        const run = await anOpenRun(1);
        await assessmentRepo.grade(db, run.assessmentId);

        const result = await responseRepo.listForReview(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value[0].topicTitle).not.toBeNull();
        expect(result.value[0].studyAdvice).not.toBeNull();
    });

    it('orders the options identically to listForRun', async () => {
        // The results page highlights "the option you picked". It reads through
        // listForReview while the run screen read through listForRun, so a
        // different shuffle between the two moves the highlight onto a
        // different answer than the one the member clicked.
        const run = await anOpenRun(3);
        await assessmentRepo.grade(db, run.assessmentId);

        const forRun = await responseRepo.listForRun(db, run.assessmentId);
        const forReview = await responseRepo.listForReview(db, run.assessmentId);

        expect(forRun.ok && forReview.ok).toBe(true);
        if (!forRun.ok || !forReview.ok) return;

        expect(forReview.value.map((i) => i.options.map((o) => o.answerId))).toEqual(
            forRun.value.map((q) => q.options.map((o) => o.answerId)),
        );
    });

    it('reports is_correct as false rather than null on an ungraded run', async () => {
        // `row.is_correct === true` collapses the null of an ungraded response
        // into false. Worth pinning: it means "not yet graded" and "answered
        // wrongly" are the same value to every caller.
        const run = await anOpenRun(2);

        const result = await responseRepo.listForReview(db, run.assessmentId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.every((i) => i.isCorrect === false)).toBe(true);
    });
});

describe('saveSelection', () => {
    it('updates the pre-created row and stamps answered_at', async () => {
        // It never inserts: the set of questions on a paper is fixed the moment
        // the run starts, so a missing row means a bug upstream, not a row to
        // create here.
        const run = await anOpenRun(2);
        const target = run.questions[0];

        const result = await responseRepo.saveSelection(
            db,
            run.assessmentId,
            target.questionId,
            target.correctAnswerId,
        );

        expect(result.ok).toBe(true);

        const { data } = await db
            .from('student_responses')
            .select('selected_answer_id, answered_at')
            .eq('assessment_id', run.assessmentId)
            .eq('question_id', target.questionId)
            .single();

        expect(data?.selected_answer_id).toBe(target.correctAnswerId);
        // student_responses_answered_at_present makes this a constraint, not a
        // nicety: a selection without a timestamp is rejected outright.
        expect(data?.answered_at).not.toBeNull();
    });

    it('replaces an earlier answer instead of adding a second row', async () => {
        const run = await anOpenRun(2);
        const target = run.questions[0];

        await responseRepo.saveSelection(
            db,
            run.assessmentId,
            target.questionId,
            target.wrongAnswerIds[0],
        );
        await responseRepo.saveSelection(
            db,
            run.assessmentId,
            target.questionId,
            target.correctAnswerId,
        );

        const { data, count } = await db
            .from('student_responses')
            .select('selected_answer_id', { count: 'exact' })
            .eq('assessment_id', run.assessmentId)
            .eq('question_id', target.questionId);

        expect(count).toBe(1);
        expect(data?.[0].selected_answer_id).toBe(target.correctAnswerId);
    });

    it('is scoped to one assessment, so it cannot touch another run of the same question', async () => {
        const first = await anOpenRun(2);

        const other = await sandbox.createUser();
        const created = await assessmentRepo.createWithResponses(db, {
            userId: other.userId,
            categoryId: first.category.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: first.questions.map((q) => q.questionId),
        });
        expect(created.ok).toBe(true);
        if (!created.ok) return;

        const target = first.questions[0];
        await responseRepo.saveSelection(
            db,
            first.assessmentId,
            target.questionId,
            target.correctAnswerId,
        );

        const { data } = await db
            .from('student_responses')
            .select('selected_answer_id')
            .eq('assessment_id', created.value)
            .eq('question_id', target.questionId)
            .single();

        // Two members sitting the same question. Without the assessment_id
        // clause one member's answer would land on the other's paper.
        expect(data?.selected_answer_id).toBeNull();
    });

    it('reports an answer id that does not exist as a validation failure', async () => {
        const run = await anOpenRun(1);

        const result = await responseRepo.saveSelection(
            db,
            run.assessmentId,
            run.questions[0].questionId,
            -1,
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('validation');
    });
});
