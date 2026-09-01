/**
 * Tests for lib/validation/filters.schema.ts.
 *
 * Everything here arrives as a string from a URL, and none of it is trusted.
 * The `.catch()` fallbacks matter more than the happy path: a hand-edited query
 * string must land on a sane page rather than throwing, because search params
 * are the one input a member can type directly into the address bar.
 */

import { describe, it, expect } from 'vitest';
import { userFiltersSchema, resultFiltersSchema } from '../../../lib/validation/filters.schema';

describe('userFiltersSchema', () => {
    it('trims the search term and coerces the page number', () => {
        const parsed = userFiltersSchema.safeParse({
            search: '   ion   ',
            role: 'student',
            page: '2',
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data?.search).toBe('ion');
        expect(parsed.data?.page).toBe(2);
    });

    it('accepts an empty query string, defaulting every filter', () => {
        const parsed = userFiltersSchema.safeParse({});

        expect(parsed.success).toBe(true);
        expect(parsed.data?.page).toBe(1);
    });
});

describe('resultFiltersSchema', () => {
    it('falls back to a sane sort and page for junk input', () => {
        const parsed = resultFiltersSchema.safeParse({ sort: 'invalid_sort_value', page: 'junk' });

        expect(parsed.success).toBe(true);
        expect(parsed.data?.sort).toBe('date_desc');
        expect(parsed.data?.page).toBe(1);
    });

    it('never returns a page below the first one', () => {
        expect(resultFiltersSchema.safeParse({ page: '-5' }).data?.page).toBe(1);
        expect(resultFiltersSchema.safeParse({ page: '0' }).data?.page).toBe(1);
    });
});
