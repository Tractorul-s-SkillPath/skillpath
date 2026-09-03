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

import { z } from 'zod';

/**
 * Draft Question Schema:
 * - 2 to 6 options
 * - Exact match invariant: corectAnswer trebuie să se regăsească printre opțiuni.
 */
export const draftQuestionSchema = z.object({
    question: z.string().min(1, 'Question text is required'),
    options: z.array(z.string().min(1)).min(2, 'At least 2 options are required').max(6, 'Maximum 6 options allowed'),
    correctAnswer: z.string().min(1, 'Correct answer is required'),
}).refine((data) => data.options.includes(data.correctAnswer), {
    message: 'The correct answer must be one of the provided options.',
    path: ['correctAnswer'],
});

export const draftQuestionsSchema = z.array(draftQuestionSchema);

/**
 * Enhanced Plan Schema:
 * - Conține descriere generată de AI cu lungime limitată (bounded length).
 */
export const enhancedPlanSchema = z.object({
    aiDescription: z.string().min(1, 'AI description is required').max(1000, 'AI description is too long'),
});

/**
 * Feedback Schema:
 * - Un simplu string cu lungime maximă controlată (bounded length).
 */
export const feedbackResponseSchema = z.string().min(1, 'Feedback cannot be empty').max(1500, 'Feedback exceeds maximum character limit');