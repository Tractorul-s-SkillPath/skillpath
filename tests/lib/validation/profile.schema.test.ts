/**
 * Tests for lib/validation/profile.schema.ts.
 *
 * Stories: SP-013, SP-021
 *
 * The key-stripping test is a privilege-escalation guard, not a tidiness check.
 * The profile action spreads the parsed result into an update, so anything the
 * schema lets through reaches the row — `role: 'admin'` included.
 */

import { describe, it, expect } from 'vitest';
import { nameSchema, interestsSchema } from '../../../lib/validation/profile.schema';

describe('nameSchema', () => {
    it('accepts a valid name change', () => {
        expect(nameSchema.safeParse({ firstName: 'Maria', lastName: 'Ionescu' }).success).toBe(
            true,
        );
    });

    it('strips unknown keys, so a role cannot ride along (SP-013 / SP-021)', () => {
        const parsed = nameSchema.safeParse({
            firstName: 'Maria',
            lastName: 'Ionescu',
            role: 'admin',
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ firstName: 'Maria', lastName: 'Ionescu' });
    });
});

describe('interestsSchema', () => {
    it('accepts an array of category ids', () => {
        expect(interestsSchema.safeParse({ categoryIds: [1, 2, 3] }).success).toBe(true);
    });

    it('accepts an empty selection — following nothing is a valid choice', () => {
        expect(interestsSchema.safeParse({ categoryIds: [] }).success).toBe(true);
    });

    it('rejects a non-numeric id', () => {
        expect(interestsSchema.safeParse({ categoryIds: ['abc'] }).success).toBe(false);
    });
});
