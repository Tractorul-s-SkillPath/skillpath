/**
 * AI orchestration — the only caller of lib/ai.
 *
 * Layer: SERVICE
 * Stories: SP-090, SP-091, SP-092, SP-093, SP-094
 *
 * Sketch
 *  enhancePlan(assessmentId)      - SP-091: writes ai_description onto existing
 *    plan rows. The rule-based plan already exists and already renders; this only
 *    ever ADDS. Persisted once, never regenerated per page view (§6.4).
 *  generateQuestions(spec)        - SP-092: returns Zod-parsed drafts for review
 *  feedbackFor(assessmentId)      - SP-093: persisted, so the same result always
 *    shows the same text; falls back to lib/domain/feedback.ts
 *
 * Every path here obeys §6: parse model output with Zod before the database,
 * degrade instead of blocking, keep the human in the loop, persist the output.
 * Provider failure is a logged, caught, non-fatal condition — never a 500 and
 * never an error banner on a page that is otherwise correct.
 *
 * Test: tests/lib/services/ai.service.test.ts  (mock provider, plus a provider
 * that throws and one that times out)
 */

import { getProvider } from '../ai/provider';
import { buildFallbackFeedback } from '../domain/feedback';

export async function feedbackForScore(
    assessmentId: string,
    score: number,
    weakAreas: string[]
): Promise<string> {
    try {
        // Obținem providerul activ (mock sau anthropic în funcție de mediu)
        const provider = getProvider();

        // Apelăm metoda de feedback din interfața providerului
        const feedback = await provider.feedback({
            score,
            weakAreas,
        });

        if (feedback) {
            return feedback;
        }

        throw new Error('Empty feedback from AI provider');
    } catch (error) {
        console.error('AI provider failed, falling back to rule-based feedback:', error);

        // Fallback-ul de siguranță cerut de arhitectură (§6)
        const result = { score };
        return buildFallbackFeedback(result, weakAreas);
    }
}