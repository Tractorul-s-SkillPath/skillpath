/**
 * Assessment timing — pure.
 *
 * Story: SP-045
 *
 * `now` is a PARAMETER. The client passes its clock for display; the server
 * passes its own on submit, which is why a frozen client timer gains nothing
 * (SP-045 AC2). Same function, both sides, one test file.
 *
 * Test: tests/lib/domain/timer.test.ts
 */

/** Seconds left on the clock, clamped at 0. Never negative, never NaN. */
export function remainingSeconds(startedAt: string, limitSeconds: number, now: Date): number {
    const started = Date.parse(startedAt);
    if (!Number.isFinite(started)) return 0;

    const elapsed = (now.getTime() - started) / 1000;
    return Math.max(0, Math.floor(limitSeconds - elapsed));
}

export function hasExpired(startedAt: string, limitSeconds: number, now: Date): boolean {
    return remainingSeconds(startedAt, limitSeconds, now) <= 0;
}

/** 1500 -> "25:00". Display only. */
export function formatClock(totalSeconds: number): string {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
