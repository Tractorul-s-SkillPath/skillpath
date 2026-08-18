/**
 * Tests for lib/domain/constants.ts.
 *
 * Story: SP-051 — "implements the documented thresholds from one constants file"
 *
 * Cases
 *  - the level thresholds are exactly 50 and 80, weak area is 60
 *  - the bands are contiguous and non-overlapping (no score falls in a gap)
 *  - QUESTIONS_PER_ASSESSMENT >= MIN_QUESTIONS_TO_GENERATE
 *
 * This file exists so that changing a threshold is a deliberate act with a
 * failing test attached, not a silent edit nobody reviews.
 */
