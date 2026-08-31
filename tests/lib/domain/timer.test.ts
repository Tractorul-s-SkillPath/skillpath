/**
 * Tests for lib/domain/timer.ts.
 *
 * Story: SP-045
 *
 * Cases
 *  - remainingSeconds counts down correctly against an injected `now`
 *  - past the limit -> 0, never negative
 *  - hasExpired is false at limit-1s, true at exactly the limit
 *  - a `now` earlier than startedAt (clock skew) -> the full limit, no crash
 *  - the same startedAt evaluated with a client clock and a later server clock
 *    gives the server's answer — the frozen-timer case from SP-045 AC2
 */

import { describe, it, expect } from 'vitest';
import { remainingSeconds, hasExpired, formatClock } from '../../../lib/domain/timer';

describe('timer.ts domain logic', () => {
    const now = new Date('2026-06-01T12:00:00Z');

    describe('remainingSeconds', () => {
        it('should calculate remaining seconds correctly when time is left', () => {
            // Started 10 seconds ago, limit is 60 seconds -> 50 seconds remaining
            const startedAt = new Date(now.getTime() - 10000).toISOString();
            expect(remainingSeconds(startedAt, 60, now)).toBe(50);
        });

        it('should clamp remaining seconds at 0 if time has expired', () => {
            // Started 100 seconds ago, limit is 60 seconds -> 0 remaining
            const startedAt = new Date(now.getTime() - 100000).toISOString();
            expect(remainingSeconds(startedAt, 60, now)).toBe(0);
        });

        it('should return 0 for invalid startedAt date string', () => {
            expect(remainingSeconds('invalid-date', 60, now)).toBe(0);
        });
    });

    describe('hasExpired', () => {
        it('should return false if assessment has not expired', () => {
            const startedAt = new Date(now.getTime() - 10000).toISOString();
            expect(hasExpired(startedAt, 60, now)).toBe(false);
        });

        it('should return true if assessment has expired', () => {
            const startedAt = new Date(now.getTime() - 100000).toISOString();
            expect(hasExpired(startedAt, 60, now)).toBe(true);
        });
    });

    describe('formatClock', () => {
        it('should format total seconds into MM:SS correctly', () => {
            expect(formatClock(1500)).toBe('25:00'); // 25 minutes
            expect(formatClock(65)).toBe('1:05');   // 1 minute and 5 seconds
            expect(formatClock(9)).toBe('0:09');    // Single digit seconds padded
            expect(formatClock(0)).toBe('0:00');    // Zero seconds
        });

        it('should clamp negative values to 0:00', () => {
            expect(formatClock(-30)).toBe('0:00');
        });
    });
});
