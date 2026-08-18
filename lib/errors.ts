/**
 * AppError taxonomy.
 *
 * Sketch
 *  kind: 'unauthenticated' | 'forbidden' | 'not_found' | 'validation'
 *      | 'conflict'        | 'ai_unavailable' | 'unexpected'
 *  each carries a safe user-facing message + optional field errors
 *
 * Rules
 *  - the message is safe to render. Database detail, table names and RLS
 *    messages never reach it.
 *  - 'conflict' is how a unique-violation (duplicate category name, duplicate
 *    in-progress assessment) travels up to become a field error rather than a 500.
 *
 * Test: tests/lib/errors.test.ts
 */
