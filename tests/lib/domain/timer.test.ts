/**
 * Tests for lib/domain/timer.ts.
 *
 * Story: SP-045
 *
 * Cases
 *  - remainingSeconds counts down correctly against an injected `now`
 *  - past the limit -> 0, never negative
 *  - hasExpired is false at limit-1s, true at exactly the limit
 *  - a `now` earlier than startedAt (clock skew) -> the full limit, no crash
 *  - the same startedAt evaluated with a client clock and a later server clock
 *    gives the server's answer — the frozen-timer case from SP-045 AC2
 */
