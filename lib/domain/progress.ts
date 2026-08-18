/**
 * Progress maths — pure.
 *
 * Stories: SP-054, SP-070, SP-072
 *
 * Sketch
 *  completionRate(items): percentage of plan items completed
 *  overallCompletion(byCategory): across all categories (SP-072)
 *  nextLevelFor(currentLevel, latestScore): what category_progress should hold
 *
 * Zero items -> 0, never NaN, never a division by zero rendered as "%".
 *
 * Test: tests/lib/domain/progress.test.ts
 */
