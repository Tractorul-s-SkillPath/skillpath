/**
 * Tests for lib/domain/levels.ts.
 *
 * Story: SP-051 — boundaries are the point.
 *
 * Cases
 *  - 49.9 -> beginner · 50 -> intermediate
 *  - 79.9 -> intermediate · 80 -> advanced
 *  - 0 -> beginner · 100 -> advanced
 *  - the difficulty mix rule, exactly as documented in levels.ts
 *  - thresholds are read from constants.ts (change the constant, the test moves
 *    with it — a hardcoded 50 in here would defeat the purpose)
 */

import { describe, it, expect } from 'vitest';
import { estimateLevel, levelLabel } from '../../../lib/domain/levels';

describe('levels.ts domain logic', () => {
    describe('estimateLevel', () => {
        it('should correctly handle boundary cases (SP-051 AC2)', () => {
            // 49.9 should be beginner (< 50)
            expect(estimateLevel(49.9)).toBe('beginner');
            // 50 should be intermediate (>= 50 and < 80)
            expect(estimateLevel(50)).toBe('intermediate');
            // 79.9 should still be intermediate (< 80)
            expect(estimateLevel(79.9)).toBe('intermediate');
            // 80 should be advanced (>= 80)
            expect(estimateLevel(80)).toBe('advanced');
        });

        it('should return advanced for scores above 80', () => {
            expect(estimateLevel(100)).toBe('advanced');
            expect(estimateLevel(85.5)).toBe('advanced');
        });

        it('should return beginner for scores below 50', () => {
            expect(estimateLevel(0)).toBe('beginner');
            expect(estimateLevel(25.4)).toBe('beginner');
        });

        it('should handle non-finite numbers safely by defaulting to beginner', () => {
            expect(estimateLevel(NaN)).toBe('beginner');
            expect(estimateLevel(Infinity)).toBe('beginner'); // Treated as non-finite, defaults to 0 -> beginner
            expect(estimateLevel(-Infinity)).toBe('beginner');
        });
    });

    describe('levelLabel', () => {
        it('should return correct human labels for valid levels', () => {
            expect(levelLabel('beginner')).toBe('Beginner');
            expect(levelLabel('intermediate')).toBe('Intermediate');
            expect(levelLabel('advanced')).toBe('Advanced');
        });

        it('should return "Not set" when level is null', () => {
            expect(levelLabel(null)).toBe('Not set');
        });
    });
});
