/**
 * Tests for lib/domain/recommendations.ts.
 *
 * Stories: SP-040, SP-060, SP-064, SP-065
 *
 * Only retakeRecommended exists so far. buildPlan(weakAreas, level, catalog) is
 * still a sketch in the source and has no test here on purpose — writing it is
 * blocked on writing the function, not on this file.
 *
 * The threshold is imported rather than typed out: constants.ts asks that these
 * numbers are never inlined anywhere, tests included, and a test that hardcodes
 * 60 keeps passing after someone moves the constant to 65.
 */

import { describe, it, expect } from 'vitest';
import { retakeRecommended } from '../../../lib/domain/recommendations';
import { WEAK_AREA_THRESHOLD } from '../../../lib/domain/constants';

describe('retakeRecommended', () => {
    it('recommends a category the member has never been assessed in', () => {
        // Following a category with no score is exactly the gap an assessment
        // closes, so absence of evidence is itself the signal here.
        expect(retakeRecommended(null)).toBe(true);
    });

    it('recommends a category scored below the weak-area threshold', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD - 1)).toBe(true);
        expect(retakeRecommended(0)).toBe(true);
    });

    it('stops recommending exactly at the threshold, not one point past it', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD)).toBe(false);
    });

    it('leaves a comfortably passed category alone', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD + 1)).toBe(false);
        expect(retakeRecommended(100)).toBe(false);
    });
});
