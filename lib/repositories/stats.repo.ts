/**
 * Admin aggregates — SQL, not JavaScript.
 *
 * Layer: REPOSITORY
 * Stories: SP-080, SP-081, SP-082, SP-086
 *
 * Sketch: overviewCounts(), weakCategoryRanking(), resultsPaged(filters).
 * Each is a single aggregate query (or a Postgres function called via rpc()).
 * If a function in this file returns more rows than the page shows, it is wrong.
 *
 * Verify each with EXPLAIN against the indexes from 0001 before closing SP-086.
 *
 * Test: tests/lib/repositories/stats.repo.test.ts (integration)
 */
