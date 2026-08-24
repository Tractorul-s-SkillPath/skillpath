/**
 * Tests for lib/result.ts.
 *
 * Cases
 *  - ok(v) / err(e) produce the discriminated shapes and narrow correctly
 *  - map only runs on ok, mapErr only on err
 *  - unwrapOr returns the fallback for err and the value for ok
 *  - ok(undefined) is still ok — absence of a value is not failure
 */
