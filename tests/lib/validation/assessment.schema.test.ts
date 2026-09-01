/**
 * Tests for lib/validation/assessment.schema.ts.
 *
 * Story: SP-055 — a score cannot be expressed as an argument. Grading happens
 * in the database; the submit payload carries the run id and nothing else, so
 * a forged total_score has nowhere to land even if a client sends one.
 */

import { describe, it, expect } from 'vitest';
import { submitSchema } from '../../../lib/validation/assessment.schema';

describe('submitSchema', () => {
    it('accepts a payload carrying only the assessment id', () => {
        expect(submitSchema.safeParse({ assessmentId: 1234 }).success).toBe(true);
    });

    it('strips a forged score rather than passing it along (SP-055)', () => {
        const parsed = submitSchema.safeParse({ assessmentId: 1234, total_score: 100 });

        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ assessmentId: 1234 });
    });

    it('rejects a payload with no assessment id', () => {
        expect(submitSchema.safeParse({}).success).toBe(false);
    });
});
