/**
 * Tests for lib/domain/scoring.ts.
 *
 * Story: SP-050 — table-driven, no mocks.
 *
 * Cases
 *  - all correct -> 100
 *  - none correct -> 0
 *  - unanswered counts as INCORRECT and stays in the denominator
 *  - a mix -> the exact expected percentage, rounded to 2dp
 *  - rounding: 2/3 -> 66.67, and the result always fits numeric(5,2)
 *  - empty response set -> the documented decision (0, or an error), not NaN
 *  - a response whose selected answer is not in the key -> incorrect, no throw
 *  - per-category split for a multi-category session (SP-048)
 *  - the function is pure: same input twice, identical output, no I/O
 */
