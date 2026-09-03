/**
 * category.repo — against the real test database.
 *
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * Integration, not unit: every assertion here is a real PostgREST round trip.
 * That is the whole point of the folder. The queries in this repository carry
 * three things a fake cannot check —
 *
 *  - `questions(count)` is an aggregate embed. Whether it returns
 *    `[{ count: n }]`, `[]` or null for a category with no questions is
 *    PostgREST's behaviour, and `row.questions[0]?.count ?? 0` is a guess until
 *    something runs it.
 *  - `.eq('questions.status', 'active')` filters the EMBEDDED rows, not the
 *    outer ones. Getting that wrong silently returns every category with its
 *    inactive questions counted in, which looks like a seeding problem.
 *  - the 23505 -> `conflict` translation, which only a real unique index emits.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as categoryRepo from '../../../lib/repositories/category.repo';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../../lib/domain/constants';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'cat-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

describe('listWithQuestionCounts', () => {
    it('returns every category, active or not, with its question count', async () => {
        const active = await sandbox.createCategoryWithBank(2);
        const hidden = await sandbox.createCategory({ status: 'inactive' });

        const result = await categoryRepo.listWithQuestionCounts(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const byId = new Map(result.value.map((c) => [c.categoryId, c]));

        expect(byId.get(active.categoryId)?.questionCount).toBe(2);
        // The admin catalog is the one list that must show a deactivated
        // category — it is where somebody turns it back on.
        expect(byId.has(hidden.categoryId)).toBe(true);
    });

    it('counts a category with no questions as 0 rather than dropping it', async () => {
        // `questions(count)` comes back as an empty array for a category with
        // no rows, so the `?? 0` fallback is what stops an empty category
        // vanishing from the admin catalog entirely.
        const empty = await sandbox.createCategory();

        const result = await categoryRepo.listWithQuestionCounts(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.find((c) => c.categoryId === empty.categoryId);

        expect(row).toBeDefined();
        expect(row?.questionCount).toBe(0);
    });

    it('orders by name', async () => {
        const result = await categoryRepo.listWithQuestionCounts(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const names = result.value.map((c) => c.name);

        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
});

describe('listStartable', () => {
    it('excludes the baseline sentinel category', async () => {
        // SP-110: the one category nobody may pick is the one the baseline
        // paper lives in. It is category 0 and it is active, so nothing but
        // this filter keeps it off the list.
        const result = await categoryRepo.listStartable(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((c) => c.categoryId)).not.toContain(
            GENERAL_KNOWLEDGE_CATEGORY_ID,
        );
    });

    it('excludes a deactivated category', async () => {
        const hidden = await sandbox.createCategory({ status: 'inactive' });

        const result = await categoryRepo.listStartable(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((c) => c.categoryId)).not.toContain(hidden.categoryId);
    });

    it('counts only ACTIVE questions, and still lists a category whose bank is all inactive', async () => {
        const category = await sandbox.createCategory();
        await sandbox.createQuestion(category.categoryId);
        await sandbox.createQuestion(category.categoryId, { status: 'inactive' });

        const result = await categoryRepo.listStartable(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.find((c) => c.categoryId === category.categoryId);

        // Two questions in the bank, one of them retired: the paper can draw
        // from one. A count of 2 here means the embedded filter is being
        // applied to the outer rows instead, which is the failure this test
        // exists for — and it looks exactly like a category being ready when
        // it is not.
        expect(row?.questionCount).toBe(1);
    });

    it('lists a category whose questions are all inactive, with a count of 0', async () => {
        // `.eq('questions.status', 'active')` filters the embed; it must NOT
        // drop the parent row. A category with a bank of retired questions is
        // shown disabled with the reason (MIN_CATEGORY_QUESTIONS is the
        // service's rule) — hiding it here would be the wrong layer, and the
        // admin who just retired those questions would think the category
        // disappeared.
        const category = await sandbox.createCategory();
        await sandbox.createQuestion(category.categoryId, { status: 'inactive' });

        const result = await categoryRepo.listStartable(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.find((c) => c.categoryId === category.categoryId);

        expect(row).toBeDefined();
        expect(row?.questionCount).toBe(0);
    });
});

describe('findStartable', () => {
    it('finds an active, non-baseline category', async () => {
        const category = await sandbox.createCategory();

        const result = await categoryRepo.findStartable(db, category.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value?.categoryId).toBe(category.categoryId);
        expect(result.value?.name).toBe(category.name);
    });

    it('returns null — not an error — for a deactivated category', async () => {
        // The distinction is the whole contract of this function: null means
        // "not startable", and the caller redirects. An error would be a 500 on
        // a link a student legitimately still has open.
        const hidden = await sandbox.createCategory({ status: 'inactive' });

        const result = await categoryRepo.findStartable(db, hidden.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeNull();
    });

    it('returns null for the baseline sentinel, which is active', async () => {
        const result = await categoryRepo.findStartable(db, GENERAL_KNOWLEDGE_CATEGORY_ID);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeNull();
    });

    it('returns null for a category id that does not exist', async () => {
        const result = await categoryRepo.findStartable(db, -1);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeNull();
    });
});

describe('findById', () => {
    it('finds a category whatever its status', async () => {
        const hidden = await sandbox.createCategory({ status: 'inactive' });

        const result = await categoryRepo.findById(db, hidden.categoryId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.categoryId).toBe(hidden.categoryId);
    });

    it('reports a missing category as not_found, not as an empty success', async () => {
        // findStartable returns null for the same input; this one errors. The
        // pair is deliberate — "you may not start this" and "this does not
        // exist" are different answers and the admin page needs the second.
        const result = await categoryRepo.findById(db, -1);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });
});

describe('insert', () => {
    it('creates a category and returns it', async () => {
        const name = `Sbx insert ${sandbox.name}`.slice(0, 60);

        const result = await categoryRepo.insert(db, name, 'Made by a test.');

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.name).toBe(name);
        expect(result.value.description).toBe('Made by a test.');

        // Registered for teardown the long way round: it was created through
        // the repository rather than the sandbox, so nothing is tracking it.
        await db.from('skill_categories').delete().eq('category_id', result.value.categoryId);
    });

    it('turns a duplicate name into a conflict carrying a field error on `name`', async () => {
        // SP-031 AC2. This is the assertion that cannot be faked: only a real
        // unique index emits 23505, and fromPostgrestError's mapping of it is
        // what stops a duplicate name being a 500.
        const existing = await sandbox.createCategory();

        const result = await categoryRepo.insert(db, existing.name, 'A second one.');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
        expect(result.error.fields?.name).toBe('A category with that name already exists.');
    });
});

describe('setStatus', () => {
    it('deactivates and reactivates a category', async () => {
        const category = await sandbox.createCategory();

        expect((await categoryRepo.setStatus(db, category.categoryId, 'inactive')).ok).toBe(true);

        const afterHide = await categoryRepo.findStartable(db, category.categoryId);
        expect(afterHide.ok && afterHide.value).toBeNull();

        expect((await categoryRepo.setStatus(db, category.categoryId, 'active')).ok).toBe(true);

        const afterShow = await categoryRepo.findStartable(db, category.categoryId);
        expect(afterShow.ok && afterShow.value?.categoryId).toBe(category.categoryId);
    });

    it('reports success for an id that matches nothing', async () => {
        // An UPDATE matching zero rows is not an error in PostgREST, and this
        // repository does not ask for a count — so the caller cannot tell the
        // difference. Pinned because it is a real gap someone will otherwise
        // discover from a "deactivate" button that silently does nothing.
        const result = await categoryRepo.setStatus(db, -1, 'inactive');

        expect(result.ok).toBe(true);
    });
});
