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

export const aiStudyPlanSchema = z.object({
    explanation: z.string().describe(
        'A natural, empathetic, and encouraging explanation of the assessment results. It should sound like feedback from a human mentor, clearly explaining where the student excels and where they have gaps.'
    ),
    recommendations: z.array(
        z.object({
            title: z.string().describe('A specific and motivating title for the study recommendation.'),
            focusArea: z.string().describe('The exact topic or category from the assessment that needs improvement.'),
            rationale: z.string().describe('A detailed justification of why this recommendation is needed, directly tied to the assessment results.'),
            actionItems: z.array(z.string()).describe('A list of 2-4 concrete, exact, and actionable steps the student should follow to learn.'),
            estimatedMinutes: z.number().describe('The estimated time in minutes to complete this study module (e.g., 15, 30, 45).')
        })
    ).describe('An array of highly detailed, personalized learning recommendations.')
});

export type AIStudyPlan = z.infer<typeof aiStudyPlanSchema>;