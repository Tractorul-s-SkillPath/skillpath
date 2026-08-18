/**
 * Integration tests for lib/repositories/category.repo.ts.
 *
 * Cases
 *  - listPaged returns question counts in ONE query, not N+1
 *  - a duplicate name surfaces as a typed conflict, not a raw Postgres error
 *  - listActiveWithEligibleQuestions excludes inactive categories and ones
 *    whose only questions are inactive or have no correct answer
 *  - deleting a category that has questions is refused by on delete restrict
 */
