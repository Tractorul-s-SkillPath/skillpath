/**
 * Tests for app/(student)/assessments/[id]/actions.ts.
 *
 * Stories: SP-043, SP-046, SP-047, SP-055
 *
 * Cases
 *  - saveAnswer requires auth and parses ids; it never takes a user id
 *  - saveAnswer on someone else's assessment -> forbidden, no write
 *  - submit calls the grading service and redirects to the results page
 *  - a submit payload containing total_score=100 is rejected at the schema —
 *    the direct action-level assertion for SP-055
 *  - submitting an already-submitted assessment -> conflict, no re-scoring
 *  - abandon sets the status and redirects to /assessments/new
 */
