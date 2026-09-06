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

import { FeedbackContext, EnhancedPlan, DraftQuestion, AiProvider } from './provider';
import { feedbackResponseSchema, enhancedPlanSchema, draftQuestionsSchema } from './schemas';

if (typeof window !== 'undefined') {
    throw new Error('Anthropic provider can only be used on the server-side.');
}

const TIMEOUT_MS = 10000;

async function callAnthropicApi(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const textBlock = data.content?.find((c: { type: string; text?: string }) => c.type === 'text');
        return textBlock?.text || '';
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function callWithTimeoutAndRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            return await fn();
        } catch (error) {
            if (attempts >= maxAttempts) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }

    throw new Error('Max retry attempts reached');
}

export const anthropicProvider: AiProvider = {
    async enhancePlan(input: { assessmentId: string }): Promise<EnhancedPlan> {
        return callWithTimeoutAndRetry(async () => {
            const prompt = `Enhance plan for assessment ID: ${input.assessmentId}`;
            const rawContent = await callAnthropicApi(prompt, 400);

            const parsedJson = JSON.parse(rawContent || '{}');
            return enhancedPlanSchema.parse(parsedJson);
        });
    },

    async generateQuestions(spec: { topic: string; count: number }): Promise<DraftQuestion[]> {
        return callWithTimeoutAndRetry(async () => {
            const prompt = `Generate ${spec.count} questions for topic: ${spec.topic}`;
            const rawContent = await callAnthropicApi(prompt, 800);

            const parsedJson = JSON.parse(rawContent || '[]');
            return draftQuestionsSchema.parse(parsedJson);
        });
    },

    async feedback(input: FeedbackContext): Promise<string> {
        return callWithTimeoutAndRetry(async () => {
            const prompt = `Generate personalized feedback for a score of ${input.score}% with weak areas: ${input.weakAreas.join(', ')}`;
            const rawContent = await callAnthropicApi(prompt, 300);

            return feedbackResponseSchema.parse(rawContent);
        });
    },
};