/**
 * Tests for lib/validation/auth.schema.ts.
 *
 * Stories: SP-010, SP-011
 *
 * Both schemas matter and both are here. loginSchema guards the busiest form in
 * the product; registerSchema carries the password policy that SP-011 AC3 says
 * client and server must apply identically — which is only true while both
 * import this file, so the boundaries below are what makes the claim testable.
 */

import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '../../../lib/validation/auth.schema';
import { fieldErrors } from '../../../lib/validation/common';

const validRegistration = {
    name: 'Ion Popescu',
    email: 'student@test.com',
    password: 'StrongPassword123!',
    confirmPassword: 'StrongPassword123!',
};

describe('loginSchema', () => {
    it('accepts an email and a non-empty password', () => {
        const parsed = loginSchema.safeParse({ email: 'student@test.com', password: 'x' });

        expect(parsed.success).toBe(true);
    });

    it.each([
        ['a malformed email', { email: 'not-an-email', password: 'x' }],
        ['an empty password', { email: 'student@test.com', password: '' }],
        ['a missing password', { email: 'student@test.com' }],
        ['a missing email', { password: 'x' }],
    ])('rejects %s', (_label, input) => {
        expect(loginSchema.safeParse(input).success).toBe(false);
    });

    it('does not apply the registration password policy to an existing member', () => {
        // A member whose password predates the 8-character rule must still be
        // able to log in and change it. Enforcing the policy here would lock
        // them out of the form that fixes it.
        expect(
            loginSchema.safeParse({ email: 'student@test.com', password: 'short' }).success,
        ).toBe(true);
    });
});

describe('registerSchema', () => {
    it('accepts a complete, well-formed registration', () => {
        expect(registerSchema.safeParse(validRegistration).success).toBe(true);
    });

    it('rejects a registration whose passwords disagree', () => {
        const parsed = registerSchema.safeParse({
            ...validRegistration,
            confirmPassword: 'DifferentPassword456!',
        });

        expect(parsed.success).toBe(false);
    });

    it('blames the confirm field, not the password field, for a mismatch', () => {
        // The refine sets path: ['confirmPassword'] so the message lands under
        // the input the member should retype. A form that renders fieldErrors
        // shows nothing at all if this path moves.
        const parsed = registerSchema.safeParse({
            ...validRegistration,
            confirmPassword: 'DifferentPassword456!',
        });

        expect(parsed.success).toBe(false);
        if (parsed.success) return;

        expect(Object.keys(fieldErrors(parsed.error))).toEqual(['confirmPassword']);
    });

    it('enforces the 8-character minimum at the boundary (SP-011 AC3)', () => {
        const sevenChars = 'Abc123!';
        const eightChars = 'Abc123!x';

        expect(sevenChars).toHaveLength(7);
        expect(
            registerSchema.safeParse({
                ...validRegistration,
                password: sevenChars,
                confirmPassword: sevenChars,
            }).success,
        ).toBe(false);

        expect(
            registerSchema.safeParse({
                ...validRegistration,
                password: eightChars,
                confirmPassword: eightChars,
            }).success,
        ).toBe(true);
    });

    it('enforces the 60-character name limit at the boundary, matching the SQL check', () => {
        expect(
            registerSchema.safeParse({ ...validRegistration, name: 'A'.repeat(60) }).success,
        ).toBe(true);
        expect(
            registerSchema.safeParse({ ...validRegistration, name: 'A'.repeat(61) }).success,
        ).toBe(false);
    });

    it('rejects a malformed email', () => {
        expect(registerSchema.safeParse({ ...validRegistration, email: 'student@' }).success).toBe(
            false,
        );
    });

    it('accepts an empty name today — SEE SP-119', () => {
        // Documenting what it does. `name` is max(60) with no minimum, so ''
        // registers a member with no name. The SQL side has a
        // length(trim(name)) > 0 check, so this fails at the database instead
        // of in the form. Same root cause as trimmedString; raised as SP-119.
        expect(registerSchema.safeParse({ ...validRegistration, name: '' }).success).toBe(true);
    });
});
