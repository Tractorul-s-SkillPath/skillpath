/**
 * URL search-param schemas.
 *
 * Stories: SP-084, SP-085, SP-086
 *
 * Sketch: questionFilters, userFilters, resultFilters, categoryFilters —
 * each parsing raw searchParams into typed, bounded query input.
 *
 * Parsing the URL through Zod is what makes "filter state lives in the URL"
 * safe: a hand-edited ?pageSize=100000 is clamped here, before it reaches SQL.
 *
 * Test: tests/lib/validation/filters.schema.test.ts
 */
