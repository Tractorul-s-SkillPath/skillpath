/**
 * Integration tests for lib/repositories/assessment.repo.ts.
 *
 * Stories: SP-041, SP-042, SP-046
 *
 * Cases
 *  - createWithResponses is atomic: a failure part-way leaves no assessment
 *  - a second in-progress row for the same (user, category) is refused by the
 *    partial unique index, and the repo returns the existing id (SP-042)
 *  - a different category CAN have its own in-progress run at the same time
 *  - markSubmitted with a null score is refused by assessment_score_present
 *  - listAll is ordered and bounded
 */
