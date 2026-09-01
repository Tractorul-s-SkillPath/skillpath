/**
 * Tests for lib/validation/category.schema.ts.
 *
 * The length bounds mirror the SQL check on `categories.name`. They are here so
 * an admin gets a field error instead of a 500 from the database.
 */

import { describe, it, expect } from 'vitest';
import { categorySchema } from '../../../lib/validation/category.schema';

describe('categorySchema', () => {
    it('accepts a well-formed category', () => {
        expect(categorySchema.safeParse({ name: 'Databases', description: 'Valid' }).success)
            .toBe(true);
    });

    it('rejects a name shorter than two characters', () => {
        expect(categorySchema.safeParse({ name: 'A', description: 'Valid' }).success).toBe(false);
    });

    it('enforces the 60-character limit at the boundary', () => {
        expect(
            categorySchema.safeParse({ name: 'A'.repeat(60), description: 'Valid' }).success,
        ).toBe(true);
        expect(
            categorySchema.safeParse({ name: 'A'.repeat(61), description: 'Valid' }).success,
        ).toBe(false);
    });
});
