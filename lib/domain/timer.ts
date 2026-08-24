/**
 * Assessment timing — pure.
 *
 * Story: SP-045
 *
 * Sketch
 *  remainingSeconds(startedAt, limitSeconds, now): number   -- clamped at 0
 *  hasExpired(startedAt, limitSeconds, now): boolean
 *
 * `now` is a PARAMETER. The client passes its clock for display; the server
 * passes its own on submit, which is why a frozen client timer gains nothing
 * (SP-045 AC2). Same function, both sides, one test file.
 *
 * Test: tests/lib/domain/timer.test.ts
 */
