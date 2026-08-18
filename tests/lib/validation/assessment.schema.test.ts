/**
 * Tests for lib/validation/assessment.schema.ts.
 *
 * Stories: SP-040, SP-043, SP-055
 *
 * Cases
 *  - startSchema needs at least one category id and a valid level
 *  - saveAnswerSchema rejects a missing answerId
 *  - submitSchema parses { assessmentId } and STRIPS/REJECTS total_score —
 *    the direct assertion for SP-055
 *  - no schema in this file accepts a userId from the client
 */
