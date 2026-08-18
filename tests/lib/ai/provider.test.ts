/**
 * Tests for lib/ai/provider.ts.
 *
 * Story: SP-090
 *
 * Cases
 *  - AI_PROVIDER unset -> the mock provider (the safe default)
 *  - AI_PROVIDER=mock -> mock; =anthropic -> anthropic
 *  - an unknown value -> mock plus a warning, never a crash at import time
 *  - both implementations satisfy the same interface (compile-time + a shape test)
 */
