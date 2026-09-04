/**
 * plan.repo — against the real test database.
 *
 * Stories: SP-060, SP-061, SP-062, SP-063, SP-065
 *
 * Two things here belong to the database and to nothing else:
 *
 *  - `completed_at` is maintained by a BEFORE trigger and the XP award by an
 *    AFTER one, so `setStatus` sends a single column and the rest happens
 *    where no test double can see it. `plan.service.test.ts` asserts the
 *    repository was called; only this file can say the timestamp was written.
 *  - un-ticking and re-ticking an item must not pay twice. That is
 *    `xp_events_plan_item_once`, a unique index, and a fake has no index.
 *
 * The ownership clause is the third: with no RLS underneath, `.eq('user_id',…)`
 * in findById and setStatus is the only thing stopping one member ticking off
 * another's plan by guessing an id (SP-063 AC2).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as planRepo from '../../../lib/repositories/plan.repo';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'plan-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

/** A member with a graded run and a three-item plan hanging off it. */
async function aMemberWithAPlan() {
    const member = await sandbox.createUser();
    const category = await sandbox.createCategoryWithBank(2);

    const created = await assessmentRepo.createWithResponses(db, {
        userId: member.userId,
        categoryId: category.categoryId,
        requestedLevel: 'beginner',
        timeLimitSeconds: 600,
        questionIds: category.questions.map((q) => q.questionId),
    });

    if (!created.ok) throw new Error(`could not open a run: ${created.error.message}`);
    await assessmentRepo.grade(db, created.value);

    const written = await planRepo.insertMany(
        db,
        member.userId,
        category.categoryId,
        created.value,
        [
            { topicTitle: 'Indexes and query plans', description: 'Revisit them.', priority: 1 },
            { topicTitle: 'Normal forms', description: 'Third normal form.', priority: 2 },
            { topicTitle: 'Transactions', description: 'Isolation levels.', priority: 3 },
        ],
    );

    if (!written.ok) throw new Error(`could not write a plan: ${written.error.message}`);

    return { member, category, assessmentId: created.value };
}

describe('insertMany', () => {
    it('writes every item as not_started, with no completion date', async () => {
        const { member } = await aMemberWithAPlan();

        const result = await planRepo.listByUser(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toHaveLength(3);
        expect(result.value.every((i) => i.status === 'not_started')).toBe(true);

        const { data } = await db
            .from('recommendation_plans')
            .select('completed_at')
            .eq('user_id', member.userId);

        expect(data?.every((r) => r.completed_at === null)).toBe(true);
    });

    it('records which run produced the advice', async () => {
        // SP-065's "latest assessment wins" cannot be asked for without it.
        const { member, assessmentId } = await aMemberWithAPlan();

        const { data } = await db
            .from('recommendation_plans')
            .select('assessment_id')
            .eq('user_id', member.userId);

        expect(data?.every((r) => r.assessment_id === assessmentId)).toBe(true);
    });

    it('writes nothing and succeeds for an empty list', async () => {
        // The generator finding no weak areas is a normal outcome, not a
        // failure — a member who scored 100 has nothing to study.
        const member = await sandbox.createUser();
        const category = await sandbox.createCategory();

        const result = await planRepo.insertMany(db, member.userId, category.categoryId, 1, []);

        expect(result.ok).toBe(true);

        const listed = await planRepo.listByUser(db, member.userId);
        expect(listed.ok && listed.value).toEqual([]);
    });
});

describe('listByUser', () => {
    it('orders most urgent first', async () => {
        const { member } = await aMemberWithAPlan();

        const result = await planRepo.listByUser(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.map((i) => i.priority)).toEqual([1, 2, 3]);
        expect(result.value[0].topicTitle).toBe('Indexes and query plans');
    });

    it('resolves the category name', async () => {
        const { member, category } = await aMemberWithAPlan();

        const result = await planRepo.listByUser(db, member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.every((i) => i.categoryName === category.name)).toBe(true);
    });

    it("returns only this member's items", async () => {
        const mine = await aMemberWithAPlan();
        const theirs = await aMemberWithAPlan();

        const result = await planRepo.listByUser(db, mine.member.userId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { data: theirRows } = await db
            .from('recommendation_plans')
            .select('recommendation_id')
            .eq('user_id', theirs.member.userId);

        const theirIds = new Set(theirRows?.map((r) => r.recommendation_id));

        expect(result.value.some((i) => theirIds.has(i.recommendationId))).toBe(false);
    });
});

describe('findById', () => {
    it('finds an item the member owns', async () => {
        const { member } = await aMemberWithAPlan();
        const listed = await planRepo.listByUser(db, member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const target = listed.value[0];

        const result = await planRepo.findById(db, member.userId, target.recommendationId);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value?.recommendationId).toBe(target.recommendationId);
    });

    it("returns null for another member's item", async () => {
        // SP-063 AC2. The ownership clause, asserted rather than assumed.
        const mine = await aMemberWithAPlan();
        const stranger = await sandbox.createUser();

        const listed = await planRepo.listByUser(db, mine.member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const result = await planRepo.findById(
            db,
            stranger.userId,
            listed.value[0].recommendationId,
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeNull();
    });
});

describe('setStatus', () => {
    it('completes an item and lets the trigger stamp completed_at', async () => {
        const { member } = await aMemberWithAPlan();
        const listed = await planRepo.listByUser(db, member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const target = listed.value[0];

        const result = await planRepo.setStatus(
            db,
            member.userId,
            target.recommendationId,
            'completed',
        );

        expect(result.ok).toBe(true);

        const { data } = await db
            .from('recommendation_plans')
            .select('progress_status, completed_at')
            .eq('recommendation_id', target.recommendationId)
            .single();

        expect(data?.progress_status).toBe('completed');
        // The repository never sent this column. If the trigger is missing from
        // a hand-built database, this is the only thing that says so.
        expect(data?.completed_at).not.toBeNull();
    });

    it('clears completed_at when an item is un-ticked', async () => {
        const { member } = await aMemberWithAPlan();
        const listed = await planRepo.listByUser(db, member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const target = listed.value[0];

        await planRepo.setStatus(db, member.userId, target.recommendationId, 'completed');
        await planRepo.setStatus(db, member.userId, target.recommendationId, 'in_progress');

        const { data } = await db
            .from('recommendation_plans')
            .select('progress_status, completed_at')
            .eq('recommendation_id', target.recommendationId)
            .single();

        expect(data?.progress_status).toBe('in_progress');
        expect(data?.completed_at).toBeNull();
    });

    it('pays the completion XP once, however many times it is re-ticked', async () => {
        // xp_events_plan_item_once. Without it, a member with a plan and a
        // patient finger has unbounded XP.
        const { member } = await aMemberWithAPlan();
        const listed = await planRepo.listByUser(db, member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const target = listed.value[0];

        for (let i = 0; i < 3; i += 1) {
            await planRepo.setStatus(db, member.userId, target.recommendationId, 'completed');
            await planRepo.setStatus(db, member.userId, target.recommendationId, 'not_started');
        }
        await planRepo.setStatus(db, member.userId, target.recommendationId, 'completed');

        const { data } = await db
            .from('xp_events')
            .select('reason, recommendation_id')
            .eq('user_id', member.userId)
            .eq('reason', 'plan_item_completed');

        expect(data).toHaveLength(1);
        expect(data?.[0].recommendation_id).toBe(target.recommendationId);
    });

    it("cannot move another member's item", async () => {
        // The write half of SP-063 AC2, and the one that matters: findById
        // returning null is a read the page could have skipped.
        const mine = await aMemberWithAPlan();
        const stranger = await sandbox.createUser();

        const listed = await planRepo.listByUser(db, mine.member.userId);
        if (!listed.ok) throw new Error('setup failed');

        const target = listed.value[0];

        const result = await planRepo.setStatus(
            db,
            stranger.userId,
            target.recommendationId,
            'completed',
        );

        // PostgREST does not call a zero-row UPDATE an error, so this reports
        // success — the row is what proves nothing moved.
        expect(result.ok).toBe(true);

        const { data } = await db
            .from('recommendation_plans')
            .select('progress_status')
            .eq('recommendation_id', target.recommendationId)
            .single();

        expect(data?.progress_status).toBe('not_started');
    });
});
