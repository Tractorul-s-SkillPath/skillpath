/**
 * Tests for lib/domain/weak-areas.ts.
 *
 * Story: SP-052
 *
 * Cases
 *  - only categories BELOW the threshold are returned; exactly 60 is not weak
 *  - ordered worst-first
 *  - equal scores tie-break deterministically (twice -> same order)
 *  - all strong -> []
 *  - all weak -> every category, still ordered
 *  - a custom threshold argument overrides the constant
 */
