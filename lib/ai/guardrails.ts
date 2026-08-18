/**
 * Safety and cost guardrails.
 *
 * Story: SP-094
 *
 * Sketch
 *  scrubContext(input)      - strips anything beyond first name + scores
 *  MAX_TOKENS_PER_REQUEST   - documented, enforced
 *  rateLimit(userId, key)   - per-user cap on the generation endpoints
 *  assertServerSide()       - defence in depth alongside admin.ts's server-only
 *
 * Two points at the demo: "we capped it, and here is the test."
 *
 * Test: tests/lib/ai/guardrails.test.ts
 */
