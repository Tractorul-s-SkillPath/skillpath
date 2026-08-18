/**
 * Scoring — pure.
 *
 * Stories: SP-050, SP-055
 *
 * Sketch
 *  scoreAssessment(responses, answerKey): { correct, total, percentage }
 *   - unanswered counts as INCORRECT (not excluded from the denominator)
 *   - percentage rounded to 2dp so it fits numeric(5,2) exactly (D6)
 *   - all correct -> 100, none -> 0, empty input -> a documented decision,
 *     not a NaN
 *  perCategoryScores(...) for the multi-category session view (SP-048)
 *
 * No mocks in its test. If this function needs a mock, it is not pure.
 *
 * Test: tests/lib/domain/scoring.test.ts
 */
