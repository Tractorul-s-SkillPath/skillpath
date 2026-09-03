/**
 * The AiProvider interface + the factory.
 *
 * Story: SP-090
 *
 * Sketch (ARCHITECTURE §6)
 *  interface AiProvider {
 *    enhancePlan(input: PlanContext): Promise<EnhancedPlan>       // C, SP-091
 *    generateQuestions(input: GenSpec): Promise<DraftQuestion[]>  // B, SP-092
 *    feedback(input: FeedbackContext): Promise<string>            // A, SP-093
 *  }
 *  getProvider(): AiProvider   - reads AI_PROVIDER, defaults to 'mock'
 *
 * Three people implement against this one file in Week 5. Agree its shape in
 * Week 3 and change it only together.
 *
 * Test: tests/lib/ai/provider.test.ts
 */

import { mockProvider } from './mock';
// import { anthropicProvider } from './anthropic'; // Când este gata

export interface PlanContext {
    assessmentId: string;
    // alte proprietăți necesare planului...
}

export interface EnhancedPlan {
    aiDescription: string;
}

export interface GenSpec {
    topic: string;
    count: number;
}

export interface DraftQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface FeedbackContext {
    score: number;
    weakAreas: string[];
}

export interface AiProvider {
    enhancePlan(input: PlanContext): Promise<EnhancedPlan>;
    generateQuestions(input: GenSpec): Promise<DraftQuestion[]>;
    feedback(input: FeedbackContext): Promise<string>;
}

/**
 * Returnează providerul activ de AI în funcție de configurația din mediu.
 * Valoarea implicită este 'mock'.
 */
export function getProvider(): AiProvider {
    const providerType = process.env.AI_PROVIDER || 'mock';

    switch (providerType.toLowerCase()) {
        case 'anthropic':
            // Aici poți returna providerul real când e implementat
            // return anthropicProvider;
            console.warn('Anthropic provider requested but not fully wired, falling back to mock.');
            return mockProvider;

        case 'mock':
        default:
            return mockProvider;
    }
}