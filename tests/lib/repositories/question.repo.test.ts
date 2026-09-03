/**
 * question.repo — against the real test database.
 *
 * Stories: SP-034, SP-035, SP-036, SP-037, SP-084, SP-092
 *
 * `insertWithAnswers` is the reason this file cannot be a unit test. It is two
 * requests pretending to be one transaction, and both halves of the pretence
 * are database behaviour:
 *
 *  - `position` is set explicitly because `answers_position_unique` is
 *    UNIQUE (question_id, position) and the column defaults to 0. Four options
 *    inserted without positions are four rows claiming slot 0. A fake accepts
 *    them all.
 *  - when the options fail, the question row is deleted again. Nothing else
 *    checks that the rollback actually removes it — and what it prevents is an
 *    active, option-less question being drawn into a real paper and shown to a
 *    student as a blank page.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as questionRepo from '../../../lib/repositories/question.repo';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;
let admin: { userId: string };

beforeAll(async () => {
    db = testClient();
    sandbox = new Sandbox(db, 'q-repo');
    admin = await sandbox.createUser({ role: 'admin' });
});

afterAll(async () => {
    await sandbox.destroy();
});

const newQuestion = (
    categoryId: number,
    overrides: Partial<questionRepo.NewQuestion> = {},
): questionRepo.NewQuestion => ({
    categoryId,
    text: `Written by a test ${Math.random().toString(36).slice(2, 8)}`,
    difficulty: 'beginner',
    createdBy: admin.userId,
    answers: [
        { text: 'Right', isCorrect: true },
        { text: 'Wrong one', isCorrect: false },
        { text: 'Wrong two', isCorrect: false },
        { text: 'Wrong three', isCorrect: false },
    ],
    ...overrides,
});

describe('listByCategory', () => {
    it('returns every question in the category with its answer key, newest first', async () => {
        const category = await sandbox.createCategory();
        const first = await sandbox.createQuestion(category.categoryId);
        const second = await sandbox.createQuestion(category.categoryId);

        const result = await questionRepo.listByCategory(db, category.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((q) => q.questionId)).toEqual([
            second.questionId,
            first.questionId,
        ]);

        const row = result.value[0];

        expect(row.answers).toHaveLength(4);
        expect(row.answers.filter((a) => a.isCorrect)).toHaveLength(1);
    });

    it('includes retired questions — this is the admin view', async () => {
        const category = await sandbox.createCategory();
        const retired = await sandbox.createQuestion(category.categoryId, { status: 'inactive' });

        const result = await questionRepo.listByCategory(db, category.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((q) => q.questionId)).toContain(retired.questionId);
    });

    it('returns an empty list for a category with no questions', async () => {
        const category = await sandbox.createCategory();

        const result = await questionRepo.listByCategory(db, category.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual([]);
    });
});

describe('listActiveIds', () => {
    it('returns active question ids only, ascending', async () => {
        const category = await sandbox.createCategory();
        const one = await sandbox.createQuestion(category.categoryId);
        const retired = await sandbox.createQuestion(category.categoryId, { status: 'inactive' });
        const two = await sandbox.createQuestion(category.categoryId);

        const result = await questionRepo.listActiveIds(db, category.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Ascending, and the retired one absent: the order IS the paper for the
        // baseline, which is taken in seed order and deliberately not shuffled.
        expect(result.value).toEqual([one.questionId, two.questionId]);
        expect(result.value).not.toContain(retired.questionId);
    });
});

describe('insertWithAnswers', () => {
    it('writes the question and its options, numbering the positions from 0', async () => {
        const category = await sandbox.createCategory();

        const result = await questionRepo.insertWithAnswers(db, newQuestion(category.categoryId));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { data } = await db
            .from('answers')
            .select('answer_text, is_correct, position')
            .eq('question_id', result.value)
            .order('position');

        expect(data?.map((a) => a.position)).toEqual([0, 1, 2, 3]);
        expect(data?.map((a) => a.answer_text)).toEqual([
            'Right',
            'Wrong one',
            'Wrong two',
            'Wrong three',
        ]);
        expect(data?.filter((a) => a.is_correct)).toHaveLength(1);

        await db.from('answers').delete().eq('question_id', result.value);
        await db.from('questions').delete().eq('question_id', result.value);
    });

    it("records the admin who wrote it, and marks the source 'manual'", async () => {
        const category = await sandbox.createCategory();

        const result = await questionRepo.insertWithAnswers(db, newQuestion(category.categoryId));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { data } = await db
            .from('questions')
            .select('created_by, source')
            .eq('question_id', result.value)
            .single();

        // What keeps an AI-generated bank tellable apart from a written one.
        expect(data?.created_by).toBe(admin.userId);
        expect(data?.source).toBe('manual');

        await db.from('answers').delete().eq('question_id', result.value);
        await db.from('questions').delete().eq('question_id', result.value);
    });

    it('leaves the new question ACTIVE, so a student can be served it', async () => {
        // The pair the e2e admin journey exists for: `insertWithAnswers` never
        // sets `status` and `listActiveIds` filters on it. Every unit test fakes
        // one side of that pair. If the column's default ever changed, an admin
        // would write questions no paper could ever draw, and nothing but a
        // real insert followed by a real draw would say so.
        const category = await sandbox.createCategory();

        const result = await questionRepo.insertWithAnswers(db, newQuestion(category.categoryId));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const active = await questionRepo.listActiveIds(db, category.categoryId);

        expect(active.ok).toBe(true);
        if (!active.ok) return;

        expect(active.value).toContain(result.value);

        await db.from('answers').delete().eq('question_id', result.value);
        await db.from('questions').delete().eq('question_id', result.value);
    });

    it('removes the question again when its options fail to insert', async () => {
        // The rollback. `answer_text` is NOT NULL, so a null option fails the
        // second request after the first has already committed — exactly the
        // shape of the partial write this function compensates for.
        const category = await sandbox.createCategory();

        const before = await questionRepo.listByCategory(db, category.categoryId);
        expect(before.ok && before.value).toHaveLength(0);

        const result = await questionRepo.insertWithAnswers(
            db,
            newQuestion(category.categoryId, {
                answers: [
                    { text: 'Fine', isCorrect: true },
                    { text: null as unknown as string, isCorrect: false },
                ],
            }),
        );

        expect(result.ok).toBe(false);

        const after = await questionRepo.listByCategory(db, category.categoryId);

        expect(after.ok).toBe(true);
        if (!after.ok) return;

        // Not "the insert failed" — that much a fake could tell you. The point
        // is that the bank is EMPTY afterwards rather than holding an active
        // question with no options.
        expect(after.value).toEqual([]);
    });

    it('reports a category that does not exist as a validation failure', async () => {
        // 23503, foreign key. The admin form can only produce this by racing a
        // deletion, but it must not be a 500 when it happens.
        const result = await questionRepo.insertWithAnswers(db, newQuestion(-1));

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('validation');
    });
});

describe('setStatus', () => {
    it('retires a question, taking it out of listActiveIds', async () => {
        const category = await sandbox.createCategory();
        const question = await sandbox.createQuestion(category.categoryId);

        expect((await questionRepo.setStatus(db, question.questionId, 'inactive')).ok).toBe(true);

        const active = await questionRepo.listActiveIds(db, category.categoryId);

        expect(active.ok).toBe(true);
        if (!active.ok) return;

        expect(active.value).not.toContain(question.questionId);
    });

    it('brings a retired question back', async () => {
        const category = await sandbox.createCategory();
        const question = await sandbox.createQuestion(category.categoryId, { status: 'inactive' });

        expect((await questionRepo.setStatus(db, question.questionId, 'active')).ok).toBe(true);

        const active = await questionRepo.listActiveIds(db, category.categoryId);

        expect(active.ok && active.value).toContain(question.questionId);
    });
});
