/**
 * Tests for lib/utils.ts.
 *
 * Cases
 *  - cn() merges conflicting Tailwind classes last-wins
 *  - date and number formatters handle null/zero without printing "NaN"
 *
 * The zero cases are the point of the formatter tests. Both functions guard
 * with an explicit null/undefined check rather than a falsy one, which is the
 * difference between a member seeing "0%" and seeing "—" on a run they genuinely
 * scored nothing on. A refactor to `if (!score)` would pass every other test in
 * this file.
 */

import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatScore, initialsOf, fullName } from '../../lib/utils';

describe('cn', () => {
    it('lets the last of two conflicting utilities win', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('keeps utilities that do not conflict', () => {
        expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
    });

    it('drops falsy conditional classes', () => {
        expect(cn('text-sm', false && 'hidden', undefined, null)).toBe('text-sm');
    });
});

describe('formatDate', () => {
    it('formats a date unambiguously, month named rather than numbered', () => {
        // Constructed in local time on purpose: `new Date('2026-08-12')` is
        // UTC midnight and prints as the 11th anywhere west of Greenwich.
        expect(formatDate(new Date(2026, 7, 12))).toBe('12 Aug 2026');
    });

    it('accepts the ISO string a Supabase row actually carries', () => {
        expect(formatDate(new Date(2026, 7, 12).toISOString())).toBe('12 Aug 2026');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
        ['an unparseable string', 'not-a-date'],
    ])('prints an em dash rather than "Invalid Date" for %s', (_label, input) => {
        expect(formatDate(input)).toBe('—');
    });
});

describe('formatScore', () => {
    it('prints a whole percentage without a decimal', () => {
        expect(formatScore(87)).toBe('87%');
    });

    it('keeps one decimal when it carries information', () => {
        expect(formatScore(87.5)).toBe('87.5%');
    });

    it('prints zero as a score, not as absence', () => {
        expect(formatScore(0)).toBe('0%');
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
    ])('prints an em dash for %s', (_label, input) => {
        expect(formatScore(input)).toBe('—');
    });
});

describe('initialsOf', () => {
    it('takes the first letter of each name, uppercased', () => {
        expect(initialsOf('ion', 'popescu', 'ion@test.com')).toBe('IP');
    });

    it('uses whichever name it has when only one is set', () => {
        expect(initialsOf('Ion', '', 'ion@test.com')).toBe('I');
        expect(initialsOf('', 'Popescu', 'ion@test.com')).toBe('P');
    });

    it('falls back to the email when neither name is set', () => {
        expect(initialsOf('', '', 'ana@test.com')).toBe('A');
    });

    it('ignores whitespace-only names, which trim to nothing', () => {
        expect(initialsOf('   ', '   ', 'ana@test.com')).toBe('A');
    });

    it('never renders empty — an avatar with no glyph reads as broken', () => {
        expect(initialsOf('', '', '')).toBe('?');
    });
});

describe('fullName', () => {
    it('joins the two names with a single space', () => {
        expect(fullName('Ion', 'Popescu')).toBe('Ion Popescu');
    });

    it('does not leave a dangling space when one name is missing', () => {
        expect(fullName('Ion', '')).toBe('Ion');
        expect(fullName('', 'Popescu')).toBe('Popescu');
    });

    it('falls back rather than rendering an empty name', () => {
        expect(fullName('', '')).toBe('Member');
    });

    it('honours a caller-supplied fallback', () => {
        expect(fullName('', '', 'Deleted user')).toBe('Deleted user');
    });
});
