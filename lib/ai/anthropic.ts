/**
 * Anthropic provider.
 *
 * Stories: SP-090, SP-094
 *
 * Sketch
 *  - server-side only; ANTHROPIC_API_KEY is never NEXT_PUBLIC_
 *  - 10s timeout, ONE retry, then fall back (§6)
 *  - responses go straight into the Zod schemas in ./schemas.ts. Nothing
 *    hand-parsed, no JSON.parse without a schema after it.
 *  - token cap per request, documented (SP-094)
 *
 * Test: tests/lib/ai/anthropic.test.ts (transport faked — this test is about
 * timeout, retry and parse behaviour, not about the model)
 */
