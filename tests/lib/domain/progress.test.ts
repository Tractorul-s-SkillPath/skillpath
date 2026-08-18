/**
 * Tests for lib/domain/progress.ts.
 *
 * Stories: SP-054, SP-070, SP-072
 *
 * Cases
 *  - completionRate: 0 of 0 -> 0, not NaN
 *  - 3 of 4 -> 75; in-progress items count as not completed
 *  - overallCompletion aggregates across categories, not an average of averages
 *  - nextLevelFor moves a student up on a strong score and does not move them
 *    down on one weak run (decide the rule, then lock it here)
 */
