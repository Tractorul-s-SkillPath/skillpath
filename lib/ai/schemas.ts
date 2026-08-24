/**
 * Zod schemas for MODEL OUTPUT.
 *
 * Stories: SP-090, SP-091, SP-092, SP-093
 *
 * Sketch
 *  draftQuestionSchema  text, 2-6 options, exactly one correct — the SAME
 *    invariant as the admin form. A model that returns two correct answers is a
 *    caught validation error, not a database constraint violation at 2am.
 *  enhancedPlanSchema   per-item ai_description, bounded length
 *  feedbackSchema       a string, bounded length
 *
 * Rule §6.1: model output is untrusted input. This file is the boundary.
 *
 * Test: tests/lib/ai/schemas.test.ts
 */
