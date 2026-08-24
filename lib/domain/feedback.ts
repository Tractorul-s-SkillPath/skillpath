/**
 * Rule-based feedback text — pure.
 *
 * Story: SP-093 (the fallback half of the AI Feedback Assistant)
 *
 * Sketch
 *  buildFallbackFeedback(result, weakAreas): string
 *   - specific, not "well done!": names the weakest category and the score
 *   - this is what renders when AI is disabled or the provider fails, and it
 *     must be good enough that a demo viewer cannot tell it is the fallback
 *
 * Keeping it pure means the whole AI feature degrades to something tested.
 *
 * Test: tests/lib/domain/feedback.test.ts
 */
