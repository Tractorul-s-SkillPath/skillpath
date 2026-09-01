/**
 * Tests for lib/validation/common.ts.
 *
 * Cases
 *  - categoryId coerces "12" -> 12 and rejects "abc", "-1", "1.5", "0"
 *  - trimmedString trims before measuring, and enforces the maximum
 *  - fieldErrors flattens a ZodError, keying root-level issues as 'form'
 *  - skillLevel accepts exactly the three values in the SQL enum
 *
 * ON ASSERTING INSIDE `if (!parsed.success)`: don't. A guarded block that never
 * runs is a test that passes having asserted nothing, so the assertion that the
 * parse failed comes first, outside the guard — the `if` that follows is there
 * to narrow the type, not to decide whether to check anything.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
    formSuccess,
    formError,
    fieldErrors,
    trimmedString,
    categoryId,
    skillLevel,
} from '../../../lib/validation/common';

describe('common.ts validation helpers', () => {
    describe('form state', () => {
        it('builds the success shape a form can render', () => {
            expect(formSuccess('Saved')).toEqual({ status: 'success', message: 'Saved' });
        });

        it('carries field-level messages alongside the summary on error', () => {
            expect(formError('Failed', { text: 'Incomplete' })).toEqual({
                status: 'error',
                message: 'Failed',
                fields: { text: 'Incomplete' },
            });
        });
    });

    describe('fieldErrors', () => {
        it('flattens a ZodError into a field -> message map', () => {
            const schema = z.object({ age: z.number().min(18, 'Too young') });
            const parsed = schema.safeParse({ age: 12 });

            expect(parsed.success).toBe(false);
            if (parsed.success) return;

            expect(fieldErrors(parsed.error)).toEqual({ age: 'Too young' });
        });

        it('keys a root-level issue as "form", since it belongs to no field', () => {
            const schema = z
                .object({ a: z.number(), b: z.number() })
                .refine((data) => data.a === data.b, { message: 'Values must match' });

            const parsed = schema.safeParse({ a: 1, b: 2 });

            expect(parsed.success).toBe(false);
            if (parsed.success) return;

            expect(fieldErrors(parsed.error)).toEqual({ form: 'Values must match' });
        });

        it('keeps the first message per field, so a form shows one error per input', () => {
            const schema = z.object({
                email: z.string().min(5, 'Too short').email('Not an email'),
            });

            const parsed = schema.safeParse({ email: 'a' });

            expect(parsed.success).toBe(false);
            if (parsed.success) return;

            expect(fieldErrors(parsed.error).email).toBe('Too short');
        });
    });

    describe('trimmedString', () => {
        it('trims before measuring, so padding cannot spend the budget', () => {
            const parsed = trimmedString(5).safeParse('  abc  ');

            expect(parsed.success).toBe(true);
            expect(parsed.data).toBe('abc');
        });

        it('rejects input that is still too long once trimmed', () => {
            expect(trimmedString(5).safeParse('abcdef').success).toBe(false);
        });

        it('accepts a whitespace-only string today — SEE SP-119', () => {
            // Documenting what it does, not what we want. '   ' trims to '',
            // and '' is within any maximum, so this passes. The SQL side has
            // length(trim(...)) > 0 checks, which means a blank category name
            // gets past Zod and is refused by the database instead — a 500
            // where there should be a field error. Raised as SP-119; when the
            // min is added, this test flips to expecting false.
            const parsed = trimmedString(5).safeParse('   ');

            expect(parsed.success).toBe(true);
            expect(parsed.data).toBe('');
        });
    });

    describe('categoryId', () => {
        it('coerces the string a URL or form actually carries', () => {
            const parsed = categoryId.safeParse('12');

            expect(parsed.success).toBe(true);
            expect(parsed.data).toBe(12);
        });

        it.each([
            ['a word', 'abc'],
            ['a negative id', '-1'],
            ['a fractional id', '1.5'],
            ['zero, which is the baseline sentinel', '0'],
            ['an empty string', ''],
        ])('rejects %s', (_label, input) => {
            expect(categoryId.safeParse(input).success).toBe(false);
        });
    });

    describe('skillLevel', () => {
        it('accepts exactly the three values in the SQL enum', () => {
            expect([...skillLevel.options].sort()).toEqual([
                'advanced',
                'beginner',
                'intermediate',
            ]);

            for (const level of skillLevel.options) {
                expect(skillLevel.safeParse(level).success).toBe(true);
            }
        });

        it.each(['expert', 'BEGINNER', '', 'novice'])('rejects %j', (input) => {
            expect(skillLevel.safeParse(input).success).toBe(false);
        });
    });
});
