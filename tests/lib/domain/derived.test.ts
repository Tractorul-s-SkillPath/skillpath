import { describe, it, expect } from 'vitest';
import {
    dayOf,
    earnedBadgeCodes,
    deriveBadges,
    deriveQuests,
    deriveOverallLevel,
    type DerivationInput,
} from '../../../lib/domain/derived';

describe('derived.ts domain logic', () => {
    describe('dayOf', () => {
        it('should format a timestamp into yyyy-mm-dd based on app timezone', () => {
            const timestamp = '2026-06-01T15:30:00Z';
            const formatted = dayOf(timestamp);
            expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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