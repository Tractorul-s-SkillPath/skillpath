/**
 * Tests for lib/validation/filters.schema.ts.
 *
 * Stories: SP-084, SP-085, SP-086
 *
 * Cases
 *  - empty searchParams -> sane defaults, never undefined-in-SQL
 *  - filters combine (category + difficulty + status + source)
 *  - ?pageSize=100000 is clamped to the maximum (SP-086: no unbounded results)
 *  - a garbage sort column falls back to the default rather than reaching SQL
 *  - round-trip: parse(serialize(filters)) === filters, so a shared URL restores
 *    exactly the same view (SP-084 AC2)
 */
