/**
 * Tests for lib/services/assessment.service.ts.
 *
 * Stories: SP-041, SP-042, SP-043, SP-044, SP-047
 *
 * Cases
 *  - generate creates one assessment plus one response row PER question, with
 *    null answers and sequential positions from 0 (SP-041)
 *  - only active questions with a correct answer are picked
 *  - an existing in-progress run -> the existing id, and no new rows (SP-042)
 *  - the repo rejecting on the partial unique index is handled, not surfaced raw
 *  - too few questions -> refuses below the minimum, per the documented rule
 *  - getRun returns responses ordered by position with the saved selections —
 *    call it twice and get the identical paper (SP-044)
 *  - getRun never returns an isCorrect field (SP-038)
 *  - saveAnswer sets answered_at; re-answering replaces, never duplicates
 *  - abandon frees the category for a new run (SP-047)
 */
