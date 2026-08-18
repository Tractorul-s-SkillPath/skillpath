/**
 * Tests for lib/services/plan.service.ts.
 *
 * Stories: SP-061, SP-062, SP-063, SP-065
 *
 * Cases
 *  - generateAndPersist links every row to the triggering assessment_id
 *  - re-running the same category UPDATES rather than duplicating (SP-061 AC2)
 *  - getPlan groups by category and orders by priority
 *  - updateItemStatus writes only progress_status — assert the repo call
 *    contains no other column (SP-063 AC3)
 *  - another student's item -> forbidden
 *  - supersession: only the latest assessment's plan is returned (SP-065)
 */
