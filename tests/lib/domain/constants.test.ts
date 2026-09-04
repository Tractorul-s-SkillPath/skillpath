/**
 * Tests for lib/domain/constants.ts.
 *
 * Stories: SP-051, SP-052, SP-101
 *
 * WHAT THIS FILE IS ALLOWED TO ASSERT
 *
 * Not the values. constants.ts closes with "Never inline these numbers
 * anywhere else — not in a component, not in a test", and it is right:
 * `expect(XP_PER_ASSESSMENT).toBe(50)` has no source of truth independent of
 * the file under test. It fails every time someone edits a constant and it
 * catches nothing, which is exactly the test SP-100 tells us to delete.
 *
 * What it asserts instead are the relationships the rest of the code assumes:
 * the level bands cover every score with no gap, the labels cover every enum
 * member, the baseline's clock agrees with its own per-question rate, the
 * sentinel category id stays unreachable through the public id schema. Each of
 * those can break while every individual number still looks sensible, and each
 * one breaks a caller somewhere else in the codebase.
 *
 * Where a check has a second, independent definition to compare against, it
 * uses it — the Zod enums in lib/validation are written by hand from the SQL
 * enums, so agreeing with them is real evidence rather than a restatement.
 *
 * NOT COVERED HERE, DELIBERATELY: the XP amounts and the level thresholds are
 * mirrored in SQL (0002_functions.sql) and nothing checks that the copies
 * agree — the drift constants.ts warns about at length. That SQL is not in
 * this repository, so the check cannot be written from here. Tracked as SP-118
 * in docs/BACKLOG.md.
 */

import { describe, it, expect } from 'vitest';
import {
    LEVEL_THRESHOLDS,
    WEAK_AREA_THRESHOLD,
    XP_PER_ASSESSMENT,
    XP_PER_SCORE_POINT,
    XP_PER_PLAN_ITEM,
    XP_PER_BADGE,
    XP_LEVEL_BASE,
    XP_LEVEL_STEP,
    LEADERBOARD_SIZE,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
    TIMER_GRACE_SECONDS,
    MIN_CATEGORY_QUESTIONS,
    CATEGORY_PAPER_SIZE,
    SECONDS_PER_QUESTION,
    APP_TIMEZONE,
    LEVEL_LABELS,
    PLAN_STATUS_LABELS,
} from '../../../lib/domain/constants';
import { categoryId, skillLevel } from '../../../lib/validation/common';
import { planStatusSchema } from '../../../lib/validation/plan.schema';

describe('constants.ts — invariants the rest of the code relies on', () => {
    describe('level bands', () => {
        it('are ordered strictly high to low, because estimateLevel takes the first match', () => {
            const mins = LEVEL_THRESHOLDS.map((t) => t.min);
            const descending = [...mins].sort((a, b) => b - a);

            expect(mins).toEqual(descending);
            expect(new Set(mins).size).toBe(mins.length);
        });

        it('leave no score between 0 and 100 without a band', () => {
            const unmatched: number[] = [];

            for (let score = 0; score <= 100; score += 0.5) {
                if (!LEVEL_THRESHOLDS.some((t) => score >= t.min)) unmatched.push(score);
            }

            expect(unmatched).toEqual([]);
        });

        it('name every skill level exactly once, and no level the enum does not have', () => {
            const banded = LEVEL_THRESHOLDS.map((t) => t.level);

            expect([...banded].sort()).toEqual([...skillLevel.options].sort());
            expect(new Set(banded).size).toBe(banded.length);
        });

        it('put the weak-area threshold inside the scoring range', () => {
            expect(WEAK_AREA_THRESHOLD).toBeGreaterThan(0);
            expect(WEAK_AREA_THRESHOLD).toBeLessThanOrEqual(100);
        });
    });

    describe('the XP economy', () => {
        it('awards whole, positive amounts — the ledger stores integers', () => {
            const awards = {
                XP_PER_ASSESSMENT,
                XP_PER_SCORE_POINT,
                XP_PER_PLAN_ITEM,
                XP_PER_BADGE,
            };

            for (const [name, amount] of Object.entries(awards)) {
                expect(`${name}=${amount}`).toBe(`${name}=${Math.round(amount)}`);
                expect(amount).toBeGreaterThan(0);
            }
        });

        it('keeps level cost rising, so xpForLevel never plateaus or reverses', () => {
            expect(XP_LEVEL_BASE).toBeGreaterThan(0);
            expect(XP_LEVEL_STEP).toBeGreaterThan(0);
        });

        it('asks for a leaderboard with at least one row on it', () => {
            expect(LEADERBOARD_SIZE).toBeGreaterThan(0);
            expect(Number.isInteger(LEADERBOARD_SIZE)).toBe(true);
        });
    });

    describe('the baseline paper', () => {
        it('hides the sentinel category behind an id no real category can hold', () => {
            // Identity columns start at 1, so anything below that is unclaimable.
            expect(GENERAL_KNOWLEDGE_CATEGORY_ID).toBeLessThan(1);
        });

        it('cannot be reached through the public category id schema', () => {
            // The sentinel is filtered out of every student-facing list. If
            // categoryId ever started accepting it, a hand-typed URL would walk
            // straight into the baseline bank.
            expect(categoryId.safeParse(GENERAL_KNOWLEDGE_CATEGORY_ID).success).toBe(false);
        });

        it('gives exactly the per-question rate a category run gets', () => {
            // SECONDS_PER_QUESTION documents itself as the baseline's own rate.
            // If someone retunes the clock and not the rate, category runs
            // silently become more or less rushed than the paper everyone
            // starts with.
            expect(BASELINE_TIME_LIMIT_SECONDS).toBe(
                BASELINE_QUESTION_COUNT * SECONDS_PER_QUESTION,
            );
        });

        it('allows a grace window that is forgiving but not a second attempt', () => {
            expect(TIMER_GRACE_SECONDS).toBeGreaterThanOrEqual(0);
            expect(TIMER_GRACE_SECONDS).toBeLessThan(BASELINE_TIME_LIMIT_SECONDS);
        });
    });

    describe('category papers', () => {
        it('never require fewer questions than a paper is allowed to draw', () => {
            expect(MIN_CATEGORY_QUESTIONS).toBeGreaterThanOrEqual(1);
            expect(CATEGORY_PAPER_SIZE).toBeGreaterThanOrEqual(MIN_CATEGORY_QUESTIONS);
        });

        it('hold the baseline to at least the bar a category has to clear', () => {
            expect(BASELINE_QUESTION_COUNT).toBeGreaterThanOrEqual(MIN_CATEGORY_QUESTIONS);
        });
    });

    describe('display', () => {
        it('names a timezone Intl can actually resolve', () => {
            expect(() =>
                new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE }).format(new Date()),
            ).not.toThrow();
        });

        it('labels every skill level the enum defines, and only those', () => {
            expect(Object.keys(LEVEL_LABELS).sort()).toEqual([...skillLevel.options].sort());
        });

        it('labels every plan status the enum defines, and only those', () => {
            const statuses = planStatusSchema.shape.status.options;

            expect(Object.keys(PLAN_STATUS_LABELS).sort()).toEqual([...statuses].sort());
        });

        it('never shows a member a raw snake_case enum value', () => {
            const labels = [...Object.values(LEVEL_LABELS), ...Object.values(PLAN_STATUS_LABELS)];

            for (const label of labels) {
                expect(label).not.toBe('');
                expect(label).not.toMatch(/_/);
            }
        });
    });
});
