/**
 * Weak area identification — pure.
 *
 * Story: SP-052
 *
 * Sketch
 *  identifyWeakAreas(perCategory, threshold = WEAK_AREA_THRESHOLD): CategoryId[]
 *   - returns categories scoring BELOW the threshold, ordered worst-first
 *   - ties broken deterministically (by category id) so the plan built from
 *     this is reproducible (SP-060 AC1)
 *
 * Test: tests/lib/domain/weak-areas.test.ts
 */
