/**
 * Plan schemas.
 *
 * Story: SP-063
 *
 * The status change carries the item and the new status AND NOTHING ELSE.
 * topic_title and priority are absent by design (SP-063 AC3): a member moves
 * an item along, they do not rewrite it.
 *
 * The enum uses underscores, matching `plan_status` in 0001_init.sql. It used
 * to be `('not started', 'in progress', 'completed')` — with spaces — and
 * every layer carried a warning about it; the restructure made it a real enum.
 *
 * Test: tests/lib/validation/plan.schema.test.ts
 */

import { z } from 'zod';

export const planStatusSchema = z.object({
    recommendationId: z.coerce.number().int().positive(),
    status: z.enum(['not_started', 'in_progress', 'completed']),
});
