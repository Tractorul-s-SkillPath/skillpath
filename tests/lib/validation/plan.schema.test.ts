/**
 * Tests for lib/validation/plan.schema.ts.
 *
 * Story: SP-063 AC3 — a member moves an item along, they do not rewrite it.
 * The schema is the enforcement, so the stripping test below is the AC.
 */

import { describe, it, expect } from 'vitest';
import { planStatusSchema } from '../../../lib/validation/plan.schema';

describe('planStatusSchema', () => {
    it('accepts a status change', () => {
        expect(planStatusSchema.safeParse({ recommendationId: 10, status: 'completed' }).success)
            .toBe(true);
    });

    it.each(['not_started', 'in_progress', 'completed'])('accepts the "%s" status', (status) => {
        expect(planStatusSchema.safeParse({ recommendationId: 10, status }).success).toBe(true);
    });

    it('rejects a status outside the SQL enum', () => {
        expect(
            planStatusSchema.safeParse({ recommendationId: 10, status: 'done_yesterday' }).success,
        ).toBe(false);
    });

    it('rejects the old space-separated spelling the enum used to carry', () => {
        expect(
            planStatusSchema.safeParse({ recommendationId: 10, status: 'in progress' }).success,
        ).toBe(false);
    });

    it('drops an attempt to rewrite the item itself (SP-063 AC3)', () => {
        const parsed = planStatusSchema.safeParse({
            recommendationId: 10,
            status: 'completed',
            topic_title: 'Something else entirely',
            priority: 1,
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ recommendationId: 10, status: 'completed' });
    });
});
