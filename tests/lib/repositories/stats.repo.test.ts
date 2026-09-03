/**
 * stats.repo — against the real test database.
 *
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * Everything in this file is SQL the application never sees. `admin_overview`
 * and `category_score_summary` are views, because PostgREST has no GROUP BY —
 * a fake standing in for them proves the mapper works and says nothing about
 * whether the aggregate is right, or whether the view exists at all.
 *
 * `resultsPaged` carries the subtler one. `!inner` on both embeds is what makes
 * a search on the student's name filter the PARENT rows; without it PostgREST
 * applies the filter to the embed only, every assessment still comes back, and
 * the screen reads as "the search did nothing". That is invisible to a double
 * and obvious against a database.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as assessmentRepo from '../../../lib/repositories/assessment.repo';
import * as responseRepo from '../../../lib/repositories/response.repo';
import * as statsRepo from '../../../lib/repositories/stats.repo';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

const filters = (overrides: Partial<statsRepo.ResultFilters> = {}): statsRepo.ResultFilters => ({
    search: '',
    categoryId: null,
    sort: 'date_desc',
    page: 1,
    pageSize: 25,
    ...overrides,
});

/** A member who has sat and submitted one paper, scoring exactly `score`%. */
async function aGradedRun(score: 0 | 50 | 100, lastName?: string) {
    const member = await sandbox.createUser({ lastName });
    const category = await sandbox.createCategoryWithBank(2);

    const created = await assessmentRepo.createWithResponses(db, {
        userId: member.userId,
        categoryId: category.categoryId,
        requestedLevel: 'beginner',
        timeLimitSeconds: 600,
        questionIds: category.questions.map((q) => q.questionId),
    });

    if (!created.ok) throw new Error(`could not open a run: ${created.error.message}`);

    const correct = score === 100 ? 2 : score === 50 ? 1 : 0;

    for (const [index, question] of category.questions.entries()) {
        await responseRepo.saveSelection(
            db,
            created.value,
            question.questionId,
            index < correct ? question.correctAnswerId : question.wrongAnswerIds[0],
        );
    }

    const graded = await assessmentRepo.grade(db, created.value);
    if (!graded.ok) throw new Error(`could not grade: ${graded.error.message}`);
    expect(graded.value).toBe(score);

    return { member, category, assessmentId: created.value };
}

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'stats-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

describe('overviewCounts', () => {
    it('reads the admin_overview view and returns one row', async () => {
        // `.single()` with no fallback is only safe because the view is built
        // from scalar subqueries with coalesce — it returns a row even on an
        // empty database. If that ever stops being true this throws PGRST116
        // and the admin home page 500s.
        const result = await statsRepo.overviewCounts(db);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.totalUsers).toBeGreaterThan(0);
        expect(typeof result.value.totalAssessments).toBe('number');
        expect(typeof result.value.averageScore).toBe('number');
    });

    it('counts a new member and a new submission', async () => {
        const before = await statsRepo.overviewCounts(db);
        if (!before.ok) throw new Error('setup failed');

        await aGradedRun(100);

        const after = await statsRepo.overviewCounts(db);

        expect(after.ok).toBe(true);
        if (!after.ok) return;

        expect(after.value.totalUsers).toBe(before.value.totalUsers + 1);
        expect(after.value.totalAssessments).toBe(before.value.totalAssessments + 1);
    });
});

describe('weakCategoryRanking', () => {
    it('ranks weakest first and honours the limit', async () => {
        await aGradedRun(0);
        await aGradedRun(100);

        const result = await statsRepo.weakCategoryRanking(db, 5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.length).toBeLessThanOrEqual(5);

        const scores = result.value.map((r) => r.averageScore);
        expect(scores).toEqual([...scores].sort((a, b) => a - b));
    });

    it('breaks ties by category id, so two reads agree', async () => {
        // Without the second .order(), ties come back in whatever order the
        // planner chose and two refreshes can name two different "weakest"
        // categories. That is not a flaky test — it is a flaky dashboard.
        const first = await statsRepo.weakCategoryRanking(db, 20);
        const second = await statsRepo.weakCategoryRanking(db, 20);

        expect(first.ok && second.ok).toBe(true);
        if (!first.ok || !second.ok) return;

        expect(first.value.map((r) => r.categoryId)).toEqual(
            second.value.map((r) => r.categoryId),
        );
    });

    it('includes a category as soon as it has one graded run', async () => {
        const run = await aGradedRun(0);

        const result = await statsRepo.weakCategoryRanking(db, 100);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.find((r) => r.categoryId === run.category.categoryId);

        expect(row).toBeDefined();
        expect(row?.averageScore).toBe(0);
    });
});

describe('resultsPaged', () => {
    it('lists a submitted run with the student, category, score and derived level', async () => {
        const run = await aGradedRun(100);

        const result = await statsRepo.resultsPaged(db, filters({ search: run.member.lastName }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.items.find((r) => r.assessmentId === run.assessmentId);

        expect(row).toBeDefined();
        expect(row?.email).toBe(run.member.email);
        expect(row?.categoryName).toBe(run.category.name);
        expect(row?.score).toBe(100);
        // Derived, never stored — the same rule the student's own results page
        // uses, from the same function.
        expect(row?.level).toBe('advanced');
        expect(row?.submittedAt).not.toBe('');
    });

    it('excludes an in-progress run', async () => {
        // `status = 'submitted'` is the whole definition of a result. An open
        // run has no score, so listing one prints an empty percentage.
        const member = await sandbox.createUser();
        const category = await sandbox.createCategoryWithBank(1);

        const created = await assessmentRepo.createWithResponses(db, {
            userId: member.userId,
            categoryId: category.categoryId,
            requestedLevel: 'beginner',
            timeLimitSeconds: 600,
            questionIds: category.questions.map((q) => q.questionId),
        });
        if (!created.ok) throw new Error('setup failed');

        const result = await statsRepo.resultsPaged(db, filters({ search: member.lastName }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.items).toEqual([]);
    });

    it('searches the student, filtering the assessments rather than the embed', async () => {
        // The `!inner` assertion. With a plain embed this search returns every
        // assessment in the project, some of them with a null student.
        const mine = await aGradedRun(100);
        const theirs = await aGradedRun(0);

        const result = await statsRepo.resultsPaged(db, filters({ search: mine.member.lastName }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const ids = result.value.items.map((r) => r.assessmentId);

        expect(ids).toContain(mine.assessmentId);
        expect(ids).not.toContain(theirs.assessmentId);
        expect(result.value.items.every((r) => r.studentName.trim() !== '')).toBe(true);
    });

    it('filters by category id', async () => {
        const mine = await aGradedRun(100);
        const theirs = await aGradedRun(0);

        const result = await statsRepo.resultsPaged(
            db,
            filters({ categoryId: mine.category.categoryId }),
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const ids = result.value.items.map((r) => r.assessmentId);

        expect(ids).toContain(mine.assessmentId);
        expect(ids).not.toContain(theirs.assessmentId);
    });

    it('sorts by score, both ways', async () => {
        const low = await aGradedRun(0);
        const high = await aGradedRun(100);

        const search = sandbox.name;

        const desc = await statsRepo.resultsPaged(db, filters({ search, sort: 'score_desc' }));
        expect(desc.ok).toBe(true);
        if (!desc.ok) return;

        const descIds = desc.value.items.map((r) => r.assessmentId);
        expect(descIds.indexOf(high.assessmentId)).toBeLessThan(descIds.indexOf(low.assessmentId));

        const asc = await statsRepo.resultsPaged(db, filters({ search, sort: 'score_asc' }));
        expect(asc.ok).toBe(true);
        if (!asc.ok) return;

        const ascIds = asc.value.items.map((r) => r.assessmentId);
        expect(ascIds.indexOf(low.assessmentId)).toBeLessThan(ascIds.indexOf(high.assessmentId));
    });

    it('pages with a server-side total', async () => {
        for (let i = 0; i < 3; i += 1) await aGradedRun(100);

        const result = await statsRepo.resultsPaged(
            db,
            filters({ search: sandbox.name, page: 1, pageSize: 2 }),
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.items).toHaveLength(2);
        expect(result.value.total).toBeGreaterThanOrEqual(3);
        expect(result.value.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('accepts a search term containing a comma and a bracket', async () => {
        const result = await statsRepo.resultsPaged(db, filters({ search: 'ana, pop (x)' }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.items).toEqual([]);
    });
});
