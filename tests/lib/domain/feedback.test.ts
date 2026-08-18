/**
 * Tests for lib/domain/feedback.ts.
 *
 * Story: SP-093 (fallback path)
 *
 * Cases
 *  - the text names the actual weakest category and the actual score
 *  - a strong result gets a different message from a weak one
 *  - no weak areas -> still a complete, encouraging sentence
 *  - deterministic: same result -> same string
 *  - never empty, never a template placeholder leaking through
 */
