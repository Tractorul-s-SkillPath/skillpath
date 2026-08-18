/**
 * Result<T, AppError> — the cross-layer return type.
 *
 * Convention §8: services return Results, they do not throw across layers.
 * Actions map a Result to form state; only genuinely unexpected throws reach
 * app/error.tsx.
 *
 * Sketch
 *  type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }
 *  ok(value) / err(error) constructors
 *  isOk / isErr guards, map / mapErr / unwrapOr helpers
 *
 * Keep it tiny. This is not a functional-programming library.
 *
 * Test: tests/lib/result.test.ts
 */
