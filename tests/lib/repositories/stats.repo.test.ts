/**
 * Integration tests for lib/repositories/stats.repo.ts.
 *
 * Stories: SP-080, SP-081, SP-086
 *
 * Cases
 *  - overviewCounts matches hand-counted seeded data
 *  - abandoned and in-progress assessments are excluded from the average
 *  - weakCategoryRanking is ordered and computed in SQL (one round trip)
 *  - EXPLAIN on each query shows an index scan, not a seq scan (SP-086)
 *  - resultsPaged never returns more than pageSize rows
 */
