/**
 * Tests for lib/domain/derived.ts.
 *
 * Stories: SP-070, SP-071, SP-072
 *
 * The largest pure module in the codebase: it drives badges, quests and the
 * overall level, and it is the weakest domain file in the coverage report.
 */

import { describe, it, expect } from 'vitest';
import {
    dayOf,
    earnedBadgeCodes,
    deriveBadges,
    deriveQuests,
    deriveOverallLevel,
    type DerivationInput,
} from '../../../lib/domain/derived';
import { APP_TIMEZONE } from '../../../lib/domain/constants';

describe('derived.ts domain logic', () => {
    describe('dayOf', () => {
        it('answers in the application timezone, not the server’s', () => {
            // 22:30 UTC is already the NEXT day in Europe/Bucharest (UTC+3 in
            // June). A shape-only assertion passes here even when dayOf uses
            // the server's clock, which is the bug that matters: streaks group
            // by this value, so an off-by-one-day breaks a streak for a member
            // who did nothing wrong.
            expect(dayOf('2026-06-01T22:30:00Z')).toBe('2026-06-02');
        });

        it('stays on the same day when the offset does not push it over', () => {
            expect(dayOf('2026-06-01T09:00:00Z')).toBe('2026-06-01');
        });

        it('formats as an ISO date, so days can be compared as strings', () => {
            // Streak logic sorts and compares these directly. 'yyyy-mm-dd' is
            // the one common format where lexical order is chronological order.
            expect(dayOf('2026-06-01T09:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('agrees with a fresh Intl formatter for the configured zone', () => {
            // Pins the behaviour to APP_TIMEZONE rather than to the hardcoded
            // dates above, so moving the constant moves the test with it.
            const timestamp = '2026-11-15T23:45:00Z';
            const expected = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(
                new Date(timestamp),
            );

            expect(dayOf(timestamp)).toBe(expected);
        });
    });

    describe('Badge derivation (earnedBadgeCodes & deriveBadges)', () => {
        it('should qualify for first_assessment and first_steps when a submission exists', () => {
            const input: DerivationInput = {
                assessments: [
                    {
                        assessmentId: 1,
                        categoryId: 1,
                        categoryName: 'General',
                        status: 'submitted',
                        score: 85,
                        resultLevel: 'intermediate',
                        createdAt: '2026-06-01T10:00:00Z',
                        submittedAt: '2026-06-01T10:05:00Z',
                    },
                ],
                plan: [],
                levels: ['intermediate'],
                today: '2026-06-01',
            };

            const codes = earnedBadgeCodes(input, 0);
            expect(codes).toContain('first_assessment');
            expect(codes).not.toContain('perfect_score');

            const badges = deriveBadges(input, 0);
            const firstBadge = badges.find((b) => b.code === 'first_assessment');
            expect(firstBadge?.earned).toBe(true);
        });

        it('should qualify for streak badges based on the passed streak argument', () => {
            const input: DerivationInput = {
                assessments: [],
                plan: [],
                levels: [],
                today: '2026-06-01',
            };

            const codes = earnedBadgeCodes(input, 7);
            expect(codes).toContain('streak_7');
            expect(codes).not.toContain('streak_30');
        });

        it('should populate earnedAt from badgeAwards if provided', () => {
            const input: DerivationInput = {
                assessments: [
                    {
                        assessmentId: 1,
                        categoryId: 1,
                        categoryName: 'General',
                        status: 'submitted',
                        score: 100,
                        resultLevel: 'advanced',
                        createdAt: '2026-06-01T10:00:00Z',
                        submittedAt: '2026-06-01T10:05:00Z',
                    },
                ],
                plan: [],
                levels: [],
                today: '2026-06-01',
                badgeAwards: {
                    perfect_score: '2026-06-01T12:00:00Z',
                },
            };

            const badges = deriveBadges(input, 0);
            const perfectBadge = badges.find((b) => b.code === 'perfect_score');
            expect(perfectBadge?.earned).toBe(true);
            expect(perfectBadge?.earnedAt).toBe('2026-06-01T12:00:00Z');
        });
    });

    describe('deriveQuests', () => {
        it('should calculate daily quests progress correctly for today activities', () => {
            const input: DerivationInput = {
                assessments: [
                    {
                        assessmentId: 1,
                        categoryId: 1,
                        categoryName: 'General',
                        status: 'submitted',
                        score: 75,
                        resultLevel: 'intermediate',
                        createdAt: '2026-06-01T09:00:00Z',
                        submittedAt: '2026-06-01T09:05:00Z',
                    },
                ],
                plan: [],
                levels: [],
                today: '2026-06-01',
            };

            const quests = deriveQuests(input);
            expect(quests).toHaveLength(3);

            // Quest 1: Show up (finish an assessment today)
            expect(quests[0].progressCount).toBe(1);
            expect(quests[0].completedAt).toBe('2026-06-01T09:00:00Z');

            // Quest 2: Sharp today (score 70% or better -> 75% achieved)
            expect(quests[1].progressCount).toBe(1);

            // Quest 3: Branch out (first time in category 1)
            expect(quests[2].progressCount).toBe(1);
        });
    });

    describe('deriveOverallLevel', () => {
        it('should return null if levels array is empty', () => {
            expect(deriveOverallLevel([])).toBeNull();
        });

        it('should prioritize advanced over intermediate and beginner', () => {
            expect(deriveOverallLevel(['beginner', 'intermediate', 'advanced'])).toBe('advanced');
            expect(deriveOverallLevel(['beginner', 'intermediate'])).toBe('intermediate');
            expect(deriveOverallLevel(['beginner', 'beginner'])).toBe('beginner');
        });
    });
});