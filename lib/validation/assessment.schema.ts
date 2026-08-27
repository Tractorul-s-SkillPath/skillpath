/**
 * Assessment schemas.
 *
 * Stories: SP-043, SP-046, SP-055
 *
 * submitSchema is the enforcement point for SP-055: it carries the assessment
 * id AND NOTHING ELSE. A forged total_score in the request body is not
 * "ignored by convention" — it fails to parse. There is no startSchema yet:
 * the baseline takes no input at all (the category is pinned, the level is
 * not chosen), and /assessments/new will add one when it grows real.
 *
 * Test: tests/lib/validation/assessment.schema.test.ts
 */

import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const saveAnswerSchema = z.object({
    assessmentId: id,
    questionId: id,
    answerId: id,
});

export const submitSchema = z.object({
    assessmentId: id,
});
