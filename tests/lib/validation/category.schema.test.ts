/**
 * Tests for lib/validation/category.schema.ts.
 *
 * The length bounds mirror the SQL check on `categories.name`. They are here so
 * an admin gets a field error instead of a 500 from the database.
 */

import { describe, it, expect } from 'vitest';
import { categorySchema, categoryStatusSchema } from '../../../lib/validation/category.schema';

describe('categorySchema', () => {
    it('accepts a well-formed category', () => {
        expect(categorySchema.safeParse({ name: 'Databases', description: 'Valid' }).success).toBe(
            true,
        );
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

    it('trims whitespace from name and description', () => {
        const result = categorySchema.safeParse({
            name: '  Databases  ',
            description: '  Trimmed  ',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('Databases');
            expect(result.data.description).toBe('Trimmed');
        }
    });

    it('handles null or undefined description gracefully', () => {
        expect(categorySchema.safeParse({ name: 'Databases', description: null }).success).toBe(
            true,
        );
        expect(
            categorySchema.safeParse({ name: 'Databases', description: undefined }).success,
        ).toBe(true);
    });

    it('rejects a description longer than 500 characters', () => {
        expect(
            categorySchema.safeParse({ name: 'Databases', description: 'A'.repeat(501) }).success,
        ).toBe(false);
    });
});

describe('categoryStatusSchema', () => {
    it('accepts valid category status payload with coercion', () => {
        expect(categoryStatusSchema.safeParse({ categoryId: 1, status: 'active' }).success).toBe(
            true,
        );
        expect(
            categoryStatusSchema.safeParse({ categoryId: '5', status: 'inactive' }).success,
        ).toBe(true);
    });

    it('rejects invalid categoryId or unaccepted status values', () => {
        expect(categoryStatusSchema.safeParse({ categoryId: 0, status: 'active' }).success).toBe(
            false,
        );
        expect(categoryStatusSchema.safeParse({ categoryId: -2, status: 'active' }).success).toBe(
            false,
        );
        expect(categoryStatusSchema.safeParse({ categoryId: 1, status: 'pending' }).success).toBe(
            false,
        );
    });
});
