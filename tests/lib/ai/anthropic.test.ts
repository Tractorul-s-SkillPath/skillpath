/**
 * Tests for lib/ai/anthropic.ts, with the transport faked.
 *
 * Stories: SP-090, SP-094
 *
 * Cases
 *  - a slow response is abandoned at 10s
 *  - a failure is retried exactly ONCE, then gives up
 *  - a successful response is Zod-parsed before being returned
 *  - malformed JSON -> a typed ai_unavailable error, never a raw throw
 *  - the request carries the documented max-token cap (SP-094)
 *  - no API key present -> a clear typed error, not an undefined-header 401
 */
