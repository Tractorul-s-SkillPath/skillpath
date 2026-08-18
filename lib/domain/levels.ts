/**
 * Level estimation — pure.
 *
 * Story: SP-051
 *
 * Sketch
 *  estimateLevel(percentage, difficultyMix): SkillLevel
 *   - thresholds come from constants.ts. Do not retype them here.
 *   - difficultyMix nudges the result: 80% on an all-beginner set is not the
 *     same evidence as 80% on an advanced set. Document the rule you choose,
 *     then test it — an undocumented nudge is worse than no nudge.
 *
 * Boundary cases 49.9 / 50 / 79.9 / 80 each get their own test (SP-051 AC2).
 *
 * Test: tests/lib/domain/levels.test.ts
 */
