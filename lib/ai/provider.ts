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
