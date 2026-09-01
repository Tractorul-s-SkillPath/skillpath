/**
 * Tests for lib/repositories/paging.ts.
 *
 * Stories: SP-083, SP-030
 *
 * The only file under lib/repositories that needs no database: three pure
 * functions turning validated inputs into the shapes PostgREST wants. It sits
 * in this folder because that is where its source lives, but it is excluded
 * from the database-backed run and included in the gate — see vitest.config.ts.
 *
 * `likeTerm` is the one with teeth. `.or()` takes its filters as a text string,
 * so an unquoted term containing a comma or a bracket ends the clause early and
 * the remainder is parsed as further filters. That is a filter-injection bug
 * with a search box in front of it, and the tests below are mostly about it.
 */

import { describe, it, expect } from 'vitest';
import { pageRange, toPage, likeTerm } from '../../../lib/repositories/paging';

describe('pageRange', () => {
    it('starts the first page at row 0', () => {
        // .range() takes INCLUSIVE offsets, so a 20-row page is 0..19, not 0..20.
        expect(pageRange(1, 20)).toEqual({ from: 0, to: 19 });
    });

    it('offsets each later page by a full page', () => {
        expect(pageRange(2, 20)).toEqual({ from: 20, to: 39 });
        expect(pageRange(5, 10)).toEqual({ from: 40, to: 49 });
    });

    it('spans exactly pageSize rows, whatever the page', () => {
        // The off-by-one this guards against returns 21 rows for a 20-row page,
        // which shows up as a duplicated row at the top of the next page.
        for (const [page, size] of [[1, 20], [3, 20], [7, 5], [2, 1]] as const) {
            const { from, to } = pageRange(page, size);
            expect(to - from + 1).toBe(size);
        }
    });
});

describe('toPage', () => {
    it('reports the total the database counted, not the rows returned', () => {
        // The whole point of a paged read: 20 items out of 137 matches.
        const page = toPage(['a', 'b'], 137, 1, 20);

        expect(page).toMatchObject({ total: 137, page: 1, pageSize: 20 });
        expect(page.items).toEqual(['a', 'b']);
    });

    it('falls back to the row count when PostgREST returns no count', () => {
        // `count` is null unless the request asked for it. Treating that as 0
        // would render "0 results" above a table with rows in it.
        expect(toPage(['a', 'b', 'c'], null, 1, 20)).toMatchObject({ total: 3 });
    });

    it('rounds a partial last page up', () => {
        expect(toPage([], 41, 1, 20).totalPages).toBe(3);
    });

    it('reports one page when there is nothing at all', () => {
        // Not zero: the pager renders "page 1 of 1" over an empty state, and
        // "page 1 of 0" is the kind of detail that makes a demo look broken.
        expect(toPage([], 0, 1, 20).totalPages).toBe(1);
    });

    it('reports one page when the results fit exactly', () => {
        expect(toPage([], 20, 1, 20).totalPages).toBe(1);
    });
});

describe('likeTerm', () => {
    it('wraps the term in wildcards so it matches anywhere in the value', () => {
        expect(likeTerm('ana')).toBe('"*ana*"');
    });

    it('quotes the term, so a comma cannot end the filter clause', () => {
        // Unquoted, `ana, pop` reads as two filters and PostgREST returns 400.
        expect(likeTerm('ana, pop')).toBe('"*ana, pop*"');
    });

    it('quotes the term, so a bracket cannot close the filter group', () => {
        // `x)` ending an .or() group is the filter-injection shape: everything
        // after it would be parsed as further filters.
        expect(likeTerm('x)')).toBe('"*x)*"');
    });

    it('keeps the dot in an email address as an ordinary character', () => {
        expect(likeTerm('ana@example.com')).toBe('"*ana@example.com*"');
    });

    it('drops the two characters that still mean something inside quotes', () => {
        // A quote would close the quoting early and a backslash escapes the
        // next character — neither belongs in a name or an email, so both are
        // removed rather than escaped.
        expect(likeTerm('a"b')).toBe('"*ab*"');
        expect(likeTerm('a\\b')).toBe('"*ab*"');
        expect(likeTerm('"; drop--')).toBe('"*; drop--*"');
    });

    it('trims the surrounding whitespace a search box leaves behind', () => {
        expect(likeTerm('  ana  ')).toBe('"*ana*"');
    });

    it('still produces a valid filter for an empty search', () => {
        // Matches everything, which is what an empty search box should do.
        expect(likeTerm('')).toBe('"**"');
    });
});
