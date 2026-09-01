import { describe, it, expect } from 'vitest';
import {
    xpForLevel,
    xpToReachLevel,
    standingFromXp,
    describeStreak,
} from '../../../lib/domain/gamification';

describe('gamification.ts domain logic', () => {
    describe('xpForLevel', () => {
        it('should return base XP for level 1 or lower', () => {
            expect(xpForLevel(1)).toBe(200); // XP_LEVEL_BASE
            expect(xpForLevel(0)).toBe(200);
            expect(xpForLevel(-1)).toBe(200);
        });

        it('should scale correctly for subsequent levels using XP_LEVEL_STEP', () => {
            // Level 1 -> 2 costs 200
            expect(xpForLevel(1)).toBe(200);
            // Level 2 -> 3 costs 200 + 100 = 300
            expect(xpForLevel(2)).toBe(300);
            // Level 3 -> 4 costs 200 + 2 * 100 = 400
            expect(xpForLevel(3)).toBe(400);
        });
    });

    describe('xpToReachLevel', () => {
        it('should return 0 for level 1', () => {
            expect(xpToReachLevel(1)).toBe(0);
        });

        it('should accumulate correctly for higher levels', () => {
            // Level 1 costs 200 to clear -> level 2 needs 200 cumulative
            expect(xpToReachLevel(2)).toBe(200);
            // Level 2 costs 300 -> level 3 needs 200 + 300 = 500 cumulative
            expect(xpToReachLevel(3)).toBe(500);
        });
    });

    describe('standingFromXp', () => {
        it('should return level 1 standing for 0 or negative XP', () => {
            const standing = standingFromXp(0);
            expect(standing).toEqual({
                level: 1,
                into: 0,
                span: 200,
                remaining: 200,
                percent: 0,
                totalXp: 0,
            });

            expect(standingFromXp(-50).level).toBe(1);
        });

        it('should calculate standing correctly mid-level', () => {
            // 100 XP is halfway through level 1 (span: 200)
            const standing = standingFromXp(100);
            expect(standing).toEqual({
                level: 1,
                into: 100,
                span: 200,
                remaining: 100,
                percent: 50,
                totalXp: 100,
            });
        });

        it('should handle level transitions correctly', () => {
            // Exactly 200 XP puts you at the start of level 2
            const standing = standingFromXp(200);
            expect(standing).toEqual({
                level: 2,
                into: 0,
                span: 300,
                remaining: 300,
                percent: 0,
                totalXp: 200,
            });
        });

        it('should handle non-finite numbers safely', () => {
            const standing = standingFromXp(NaN);
            expect(standing.level).toBe(1);
            expect(standing.totalXp).toBe(0);
        });
    });

    describe('describeStreak', () => {
        it('should return no streak headline if streak is 0 or lastActivityDate is null', () => {
            expect(describeStreak(0, '2026-06-01', '2026-06-01')).toEqual({
                headline: 'No streak yet',
                atRisk: false,
            });

            expect(describeStreak(5, null, '2026-06-01')).toEqual({
                headline: 'No streak yet',
                atRisk: false,
            });
        });

        it('should format correctly and show no risk if activity was done today', () => {
            expect(describeStreak(1, '2026-06-01', '2026-06-01')).toEqual({
                headline: '1 day — counted for today',
                atRisk: false,
            });

            expect(describeStreak(4, '2026-06-01', '2026-06-01')).toEqual({
                headline: '4 days — counted for today',
                atRisk: false,
            });
        });

        it('should flag atRisk if last activity was before today', () => {
            expect(describeStreak(3, '2026-05-31', '2026-06-01')).toEqual({
                headline: '3 days — keep it alive',
                atRisk: true,
            });
        });
    });
});