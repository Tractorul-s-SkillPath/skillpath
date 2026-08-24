/**
 * Tests for lib/validation/common.ts.
 *
 * Cases
 *  - id coerces "12" -> 12 and rejects "abc", "-1", "1.5"
 *  - pagination clamps pageSize to the maximum and defaults page to 1
 *  - trimmedString rejects whitespace-only input (matching the SQL
 *    length(trim(...)) checks)
 *  - each enum schema accepts exactly the values in the SQL enum and nothing else
 */
