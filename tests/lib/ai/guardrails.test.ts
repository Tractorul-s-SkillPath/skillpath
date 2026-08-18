/**
 * Tests for lib/ai/guardrails.ts.
 *
 * Story: SP-094
 *
 * Cases
 *  - scrubContext drops email, last name and user id
 *  - the rate limiter allows N calls and refuses the N+1 within the window
 *  - the limit is per user, so one admin cannot exhaust another's budget
 *  - the token cap constant is exported and actually used by the provider
 */
