/**
 * Integration tests for lib/repositories/response.repo.ts.
 *
 * Stories: SP-043, SP-044, SP-038
 *
 * Cases
 *  - listForAssessment is ordered by position and stable across calls (SP-044)
 *  - it joins the answer_options VIEW: the returned rows contain no is_correct
 *  - a duplicate (assessment_id, position) is refused by the unique constraint
 *  - saveSelection overwrites rather than inserting a second row
 *  - writeGrades sets is_correct on every row in one statement
 */
