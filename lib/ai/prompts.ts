/**
 * Prompt templates.
 *
 * Stories: SP-091, SP-092, SP-093, SP-094
 *
 * Sketch: one exported builder per capability, each taking a typed context.
 * Prompts are data, kept out of the provider so both providers share them and
 * a change is reviewable in a diff.
 *
 * SP-094: no PII beyond first name and scores goes into any prompt. Build the
 * context objects so there is nothing else available to interpolate.
 *
 * Test: tests/lib/ai/prompts.test.ts
 */

export interface PlanPromptContext {
    assessmentId: string;
    score?: number;
    firstName?: string;
}

export interface QuestionPromptContext {
    topic: string;
    count: number;
}

export interface FeedbackPromptContext {
    firstName?: string;
    score: number;
    weakAreas: string[];
}

export function buildEnhancePlanPrompt(context: PlanPromptContext): string {
    const namePart = context.firstName ? ` for student ${context.firstName}` : '';
    const scorePart = context.score !== undefined ? ` with a score of ${context.score}%` : '';

    return `Enhance the study plan for assessment ID ${context.assessmentId}${namePart}${scorePart}. Provide structured, actionable improvements in valid JSON format.`;
}

export function buildGenerateQuestionsPrompt(context: QuestionPromptContext): string {
    return `Generate exactly ${context.count} draft multiple-choice questions for the topic: "${context.topic}". Ensure each question has options and a correct answer, formatted in valid JSON matching the schema.`;
}

export function buildFeedbackPrompt(context: FeedbackPromptContext): string {
    const nameGreeting = context.firstName ? `Hey ${context.firstName}, ` : '';
    const weakAreasStr = context.weakAreas.length > 0 ? context.weakAreas.join(', ') : 'general concepts';

    return `${nameGreeting}Generate a short, unique, highly personalized motivational feedback and study tip for a student who scored ${context.score}% on their assessment. Their main weak areas to focus on are: ${weakAreasStr}. Keep it encouraging, specific, and concise.`;
}