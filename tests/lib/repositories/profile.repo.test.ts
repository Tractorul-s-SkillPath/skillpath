/**
 * profile.repo — against the real test database.
 *
 * Stories: SP-012, SP-020, SP-021, SP-022, SP-110
 *
 * THE INTEREST MODEL is what this file is really testing. There is no interests
 * table: a `category_progress` row IS the interest, so following a category and
 * having a level in it are one fact. That makes `syncInterests` a diff rather
 * than a delete-then-insert, and the reason is not tidiness — wiping and
 * re-inserting would reset every level to 'beginner' and discard every recorded
 * score. A fake keeps whatever the test put in it, so only a real round trip
 * can show the level surviving an unrelated edit.
 *
 * The upsert is against `category_progress_unique`. Two tabs submitting the
 * same new interest must produce one row, and only an index makes that true.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as profileRepo from '../../../lib/repositories/profile.repo';
import { GENERAL_KNOWLEDGE_CATEGORY_ID } from '../../../lib/domain/constants';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'prof-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

describe('findByUserId', () => {
    it('returns the member without their password', async () => {
        // USER_PUBLIC_COLUMNS, asserted rather than assumed. `select('*')` here
        // puts a scrypt hash into the props of the profile page.
        const member = await sandbox.createUser({ firstName: 'Ada', lastName: 'Lovelace' });

        const result = await profileRepo.findByUserId(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.firstName).toBe('Ada');
        expect(result.value.email).toBe(member.email);
        expect(result.value.role).toBe('student');
        expect(Object.keys(result.value)).not.toContain('password');
        expect(JSON.stringify(result.value)).not.toContain('aa:bb');
    });

    it('fails for a member who does not exist', async () => {
        // `.single()`, so PostgREST answers PGRST116 and this maps to not_found
        // rather than returning a null the caller would have to check.
        const result = await profileRepo.findByUserId(db, '00000000-0000-4000-8000-0000000000ff');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });
});

describe('updateName', () => {
    it('changes the names it is given and nothing else', async () => {
        const member = await sandbox.createUser();

        const result = await profileRepo.updateName(db, member.userId, {
            first_name: 'Grace',
            last_name: 'Hopper',
        });

        expect(result.ok).toBe(true);

        const after = await profileRepo.findByUserId(db, member.userId);

        expect(after.ok).toBe(true);
        if (!after.ok) return;

        expect(after.value.firstName).toBe('Grace');
        expect(after.value.lastName).toBe('Hopper');
        expect(after.value.email).toBe(member.email);
        expect(after.value.role).toBe('student');
    });

    it('is scoped to one member', async () => {
        const mine = await sandbox.createUser({ firstName: 'Mine' });
        const theirs = await sandbox.createUser({ firstName: 'Theirs' });

        await profileRepo.updateName(db, mine.userId, { first_name: 'Changed' });

        const other = await profileRepo.findByUserId(db, theirs.userId);

        expect(other.ok && other.value.firstName).toBe('Theirs');
    });
});

describe('listActiveCategories', () => {
    it('excludes the baseline sentinel', async () => {
        // SP-110. This is the source both the register picker and the profile
        // catalogue read from, so the one category nobody may follow is
        // filtered out once, here.
        const result = await profileRepo.listActiveCategories(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((c) => c.categoryId)).not.toContain(
            GENERAL_KNOWLEDGE_CATEGORY_ID,
        );
    });

    it('excludes a deactivated category and orders by name', async () => {
        const hidden = await sandbox.createCategory({ status: 'inactive' });

        const result = await profileRepo.listActiveCategories(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((c) => c.categoryId)).not.toContain(hidden.categoryId);

        const names = result.value.map((c) => c.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
});

describe('syncInterests', () => {
    it('adds a new interest at beginner, with no score yet', async () => {
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        const result = await profileRepo.syncInterests(db, member.userId, [category.categoryId]);

        expect(result.ok).toBe(true);

        const interests = await profileRepo.listInterests(db, member.userId);

        expect(interests.ok).toBe(true);
        if (!interests.ok) return;

        expect(interests.value).toHaveLength(1);
        expect(interests.value[0].categoryId).toBe(category.categoryId);
        expect(interests.value[0].level).toBe('beginner');
        expect(interests.value[0].lastScore).toBeNull();
    });

    it('KEEPS the level and score of an interest that stays', async () => {
        // The reason this is a diff. A delete-then-insert passes every other
        // test in this file and silently resets the member's recorded level to
        // beginner the next time they edit their interests.
        const member = await sandbox.createUser();
        const kept = await sandbox.createCategoryWithBank(2);
        const added = await sandbox.createCategory();

        await profileRepo.syncInterests(db, member.userId, [kept.categoryId]);

        // Earn a real level and score on it, the way grading does.
        const created = await assessmentRepo.createWithResponses(db, {
            userId: member.userId,
            categoryId: kept.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: kept.questions.map((q) => q.questionId),
        });
        if (!created.ok) throw new Error('setup failed');
        await assessmentRepo.grade(db, created.value);

        const before = await profileRepo.listInterests(db, member.userId);
        if (!before.ok) throw new Error('setup failed');
        const scoreBefore = before.value[0].lastScore;

        // Now add a SECOND interest. The first must be untouched.
        await profileRepo.syncInterests(db, member.userId, [kept.categoryId, added.categoryId]);

        const after = await profileRepo.listInterests(db, member.userId);

        expect(after.ok).toBe(true);
        if (!after.ok) return;

        const keptRow = after.value.find((i) => i.categoryId === kept.categoryId);

        expect(after.value).toHaveLength(2);
        expect(keptRow?.lastScore).toBe(scoreBefore);
        expect(keptRow?.lastScore).not.toBeNull();
    });

    it('removes an interest that is dropped, discarding its level', async () => {
        // The UI warns before this happens, because the row IS the level.
        const member = await sandbox.createUser();
        const first = await sandbox.createCategory();
        const second = await sandbox.createCategory();

        await profileRepo.syncInterests(db, member.userId, [
            first.categoryId,
            second.categoryId,
        ]);
        await profileRepo.syncInterests(db, member.userId, [second.categoryId]);

        const result = await profileRepo.listInterests(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((i) => i.categoryId)).toEqual([second.categoryId]);
    });

    it('clears every interest when given an empty list', async () => {
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        await profileRepo.syncInterests(db, member.userId, [category.categoryId]);
        await profileRepo.syncInterests(db, member.userId, []);

        const result = await profileRepo.listInterests(db, member.userId);

        expect(result.ok && result.value).toEqual([]);
    });

    it('is idempotent — the same set twice leaves one row', async () => {
        // The upsert against category_progress_unique. Two tabs submitting the
        // same new interest must not produce two rows; the old schema had no
        // constraint and could not prevent it.
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        await profileRepo.syncInterests(db, member.userId, [category.categoryId]);
        const second = await profileRepo.syncInterests(db, member.userId, [category.categoryId]);

        expect(second.ok).toBe(true);

        const { count } = await db
            .from('category_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', member.userId)
            .eq('category_id', category.categoryId);

        expect(count).toBe(1);
    });

    it("does not touch another member's interests", async () => {
        const mine = await sandbox.createUser();
        const theirs = await sandbox.createUser();
        const category = await sandbox.createCategory();

        await profileRepo.syncInterests(db, theirs.userId, [category.categoryId]);
        await profileRepo.syncInterests(db, mine.userId, []);

        const other = await profileRepo.listInterests(db, theirs.userId);

        expect(other.ok && other.value).toHaveLength(1);
    });
});

describe('listInterests', () => {
    it('resolves the category name and sorts by it', async () => {
        const member = await sandbox.createUser();
        const zebra = await sandbox.createCategory({ name: `Sbx zzz ${sandbox.name}`.slice(0, 60) });
        const apple = await sandbox.createCategory({ name: `Sbx aaa ${sandbox.name}`.slice(0, 60) });

        await profileRepo.syncInterests(db, member.userId, [zebra.categoryId, apple.categoryId]);

        const result = await profileRepo.listInterests(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((i) => i.name)).toEqual([apple.name, zebra.name]);
    });

    it('is empty for a member who follows nothing', async () => {
        const member = await sandbox.createUser();

        const result = await profileRepo.listInterests(db, member.userId);

        expect(result.ok && result.value).toEqual([]);
    });
});

describe('setCategoryLevel', () => {
    it('self-declares a level on an existing interest', async () => {
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        await profileRepo.syncInterests(db, member.userId, [category.categoryId]);

        const result = await profileRepo.setCategoryLevel(
            db,
            member.userId,
            category.categoryId,
            'advanced',
        );

        expect(result.ok).toBe(true);

        const interests = await profileRepo.listInterests(db, member.userId);
        expect(interests.ok && interests.value[0].level).toBe('advanced');
    });

    it('is overwritten by a later assessment — the newer evidence wins', async () => {
        // Same column the grading trigger writes, on purpose: one answer to
        // "what level am I", rather than a declared one sitting beside a
        // measured one.
        const member = await sandbox.createUser();
        const category = await sandbox.createCategoryWithBank(2);

        await profileRepo.syncInterests(db, member.userId, [category.categoryId]);
        await profileRepo.setCategoryLevel(db, member.userId, category.categoryId, 'advanced');

        const created = await assessmentRepo.createWithResponses(db, {
            userId: member.userId,
            categoryId: category.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: category.questions.map((q) => q.questionId),
        });
        if (!created.ok) throw new Error('setup failed');

        // Nothing answered, so the run grades at 0 — well below advanced.
        await assessmentRepo.grade(db, created.value);

        const interests = await profileRepo.listInterests(db, member.userId);

        expect(interests.ok).toBe(true);
        if (!interests.ok) return;

        expect(interests.value[0].lastScore).toBe(0);
        expect(interests.value[0].level).not.toBe('advanced');
    });

    it('writes nothing when the member does not follow the category', async () => {
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        const result = await profileRepo.setCategoryLevel(
            db,
            member.userId,
            category.categoryId,
            'advanced',
        );

        // A zero-row UPDATE is not an error, so this reports success. Setting a
        // level does not create the interest — syncInterests is the only thing
        // that adds one.
        expect(result.ok).toBe(true);

        const interests = await profileRepo.listInterests(db, member.userId);
        expect(interests.ok && interests.value).toEqual([]);
    });
});
