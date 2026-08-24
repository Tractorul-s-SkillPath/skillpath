/**
 * Profile update schemas.
 *
 * Stories: SP-021, SP-022
 *
 * There is no `role` key and no `status` key here. The schema is the contract:
 * a field that cannot be parsed cannot be written — and with no RLS and no
 * column trigger underneath, this schema plus the repository's explicit column
 * list is the ONLY thing stopping a crafted POST from setting role='admin'.
 *
 * Each section of the profile page saves independently, so each gets its own
 * small schema rather than one big optional-everything object — a partial
 * schema silently accepts a form that forgot to send a field.
 *
 * Test: tests/lib/validation/profile.schema.test.ts
 */

import { z } from 'zod';

export const NAME_MAX_LENGTH = 60;

export const nameSchema = z.object({
    firstName: z
        .string()
        .trim()
        .min(1, 'First name is required.')
        .max(NAME_MAX_LENGTH, `At most ${NAME_MAX_LENGTH} characters.`),
    lastName: z.string().trim().max(NAME_MAX_LENGTH, `At most ${NAME_MAX_LENGTH} characters.`),
});

/** Setting the level for one interest — writes category_progress. */
export const categoryLevelSchema = z.object({
    categoryId: z.coerce.number().int().positive(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
});

export const interestsSchema = z.object({
    categoryIds: z
        .array(z.coerce.number().int().positive())
        .max(20, 'Twenty interests is plenty.')
        .default([]),
});

/**
 * Underscores, matching the `plan_status` enum in 0001_init.sql.
 *
 * This used to be `['not started', 'in progress', 'completed']` — with spaces —
 * because the hand-made table's CHECK constraint was written that way, and a
 * comment here warned that an underscore would fail at runtime rather than at
 * compile time. The restructure replaced the CHECK with a real enum, so the
 * warning is gone along with the reason for it.
 */
export const planStatusSchema = z.object({
    recommendationId: z.coerce.number().int().positive(),
    status: z.enum(['not_started', 'in_progress', 'completed']),
});
