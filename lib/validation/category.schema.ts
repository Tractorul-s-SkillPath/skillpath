/**
 * Category schema.
 *
 * Stories: SP-031, SP-032
 *
 * The 2-60 bound is the same one `skill_categories_name_check` enforces in
 * 0001. That duplication is deliberate: Zod exists to give the admin a sentence
 * next to the field, the check constraint exists to make the rule true even for
 * a caller that never went through this file. Both trim before measuring, so
 * "  a  " is two characters to each of them.
 *
 * Test: tests/lib/validation/category.schema.test.ts
 */

import { z } from 'zod';

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 60;

export const categorySchema = z.object({
    name: z
        .string()
        .transform((value) => value.trim())
        .pipe(
            z
                .string()
                .min(CATEGORY_NAME_MIN, `Use at least ${CATEGORY_NAME_MIN} characters.`)
                .max(CATEGORY_NAME_MAX, `Keep it under ${CATEGORY_NAME_MAX} characters.`),
        ),

    // NOT NULL with a default of '' in the schema, so the form may leave it out
    // but the column never sees undefined.
    description: z
        .string()
        .nullish()
        .transform((value) => (value ?? '').trim())
        .pipe(z.string().max(500, 'Keep the description under 500 characters.')),
});

export const categoryStatusSchema = z.object({
    categoryId: z.coerce.number().int().positive(),
    status: z.enum(['active', 'inactive']),
});

export type CategoryInput = z.infer<typeof categorySchema>;
