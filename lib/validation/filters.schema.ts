/**
 * URL search-param schemas.
 *
 * Stories: SP-084, SP-085, SP-086
 *
 * Parsing the URL through Zod is what makes "filter state lives in the URL"
 * safe: a hand-edited `?page=999999999` or `?role=<script>` is normalised here,
 * before it reaches SQL, and `?pageSize=100000` is not offered at all — the
 * page size is ours, not the caller's.
 *
 * Every field uses `.catch()` rather than failing the parse. A filter is not a
 * form: nobody typed these, so a value that makes no sense should fall back to
 * the default and render the page, not show an error about a query string.
 *
 * Test: tests/lib/validation/filters.schema.test.ts
 */

import { z } from 'zod';

/** Rows per page, everywhere in the admin. One number, one place. */
export const PAGE_SIZE = 10;

/** How many categories the weakest-areas ranking shows. */
export const WEAK_CATEGORY_LIMIT = 10;

const search = z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(100))
    .catch('');

/**
 * A page number that is always a sane integer.
 *
 * The upper bound is not politeness: `.range()` on a huge offset makes Postgres
 * walk every preceding row before returning nothing.
 */
const page = z.coerce.number().int().min(1).max(10_000).catch(1);

export const userFiltersSchema = z.object({
    search,
    // `.catch(null)` covers all three of "absent", "empty string" and "junk",
    // which is what an <option value=""> and a hand-edited URL respectively send.
    role: z.enum(['student', 'admin']).nullable().catch(null),
    status: z.enum(['active', 'inactive']).nullable().catch(null),
    page,
});

export const resultFiltersSchema = z.object({
    search,
    categoryId: z.coerce.number().int().positive().nullable().catch(null),
    sort: z.enum(['date_desc', 'date_asc', 'score_desc', 'score_asc']).catch('date_desc'),
    page,
});

export type UserFilterInput = z.infer<typeof userFiltersSchema>;
export type ResultFilterInput = z.infer<typeof resultFiltersSchema>;
