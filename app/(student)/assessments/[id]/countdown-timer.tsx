/**
 * Countdown — client component.
 *
 * Story: SP-045
 *
 * Sketch
 *  - display only. Computes remaining time from started_at + limit using the
 *    pure helper in lib/domain/timer.ts
 *  - on expiry, fires the submit action once (guard against double-fire)
 *  - the server recomputes elapsed time from started_at on submit, so freezing
 *    or patching this component gains the student nothing (SP-045 AC2)
 */
