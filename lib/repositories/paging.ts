/**
 * Paging and search helpers shared by the admin repositories.
 *
 * Layer: REPOSITORY (support). No I/O — these turn already-validated inputs
 * into the shapes PostgREST wants, in one place rather than three.
 *
 * Test: tests/lib/repositories/paging.test.ts
 */

import type { Page } from '../domain/types';

/** `.range()` takes inclusive row offsets, which is one of those off-by-ones. */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
    const from = (page - 1) * pageSize;
    return { from, to: from + pageSize - 1 };
}

export function toPage<T>(items: T[], total: number | null, page: number, pageSize: number): Page<T> {
    const count = total ?? items.length;

    return {
        items,
        total: count,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(count / pageSize)),
    };
}

/**
 * A search term, quoted for a PostgREST filter string.
 *
 * `.or()` takes filters as text, so a term containing a comma or a bracket ends
 * the clause early and the rest of it is parsed as more filters. `ana, pop`
 * used to come back as a 400; `x)` could end the group. Double quotes are how
 * PostgREST is told "this is a value", and inside them a comma, a bracket and
 * the dot in an email address are all ordinary characters.
 *
 * The backslash and the quote itself are the only two characters that still
 * mean something inside the quotes, and neither belongs in a name or an email,
 * so both are dropped rather than escaped.
 *
 * `*` is PostgREST's wildcard and it is still honoured inside the quotes, which
 * is what makes this a contains-match.
 */
export function likeTerm(search: string): string {
    const cleaned = search.trim().replace(/["\\]/g, '');
    return `"*${cleaned}*"`;
}
