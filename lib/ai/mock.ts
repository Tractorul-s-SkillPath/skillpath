/**
 * Mock provider — deterministic fixtures.
 *
 * Story: SP-090
 *
 * Sketch
 *  - same input -> same output, every time. No randomness, no clock.
 *  - covers the shapes the real provider returns, including the awkward ones
 *  - exposes failure modes on demand (throw / hang / return malformed JSON) so
 *    SP-090's "provider throws or times out -> degrade gracefully" and SP-092's
 *    "malformed output -> a friendly error" both have something to test against
 *
 * Test: tests/lib/ai/mock.test.ts
 */
