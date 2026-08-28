/**
 * Assessment schemas.
 *
 * Stories: SP-043, SP-046, SP-055
 *
 * submitSchema is the enforcement point for SP-055: it carries the assessment
 * id AND NOTHING ELSE. A forged total_score in the request body is not
 * "ignored by convention" — it fails to parse. The baseline still takes no
 * input at all (the category is pinned, the level is not chosen).
 *
 * Test: tests/lib/validation/assessment.schema.test.ts
 */

import { z } from 'zod';

const id = z.coerce.number().int().positive();

/**
 * Starting a category run carries the category AND NOTHING ELSE — same shape
 * of rule as submitSchema. `positive()` also rejects the baseline's sentinel
 * id 0 at the parse: the baseline starts through /assessments/baseline, where
 * the one-attempt rule lives, never through this door.
 *
 * Parsed by the /assessments/start/[categoryId] route rather than a Server
 * Action — a run must open in a new tab, and only a link can do that. The
 * route's docblock has the reasoning; the validation rule is the same either
 * way, because the id still arrives from outside.
 */
export const startSchema = z.object({
    categoryId: id,
});

export const saveAnswerSchema = z.object({
    assessmentId: id,
    questionId: id,
    answerId: id,
});

export const submitSchema = z.object({
    assessmentId: id,
});
