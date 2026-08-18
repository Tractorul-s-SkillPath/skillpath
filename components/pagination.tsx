/**
 * Pagination control.
 *
 * Stories: SP-030, SP-033, SP-082, SP-086
 *
 * Sketch
 *  - page + pageSize in the URL, so it survives refresh and is shareable
 *  - renders from a total count returned by the query; never "load everything
 *    and slice"
 *
 * Test: tests/components/pagination.test.tsx
 */
