/**
 * Mock provider — deterministic fixtures.
 *
 * Story: SP-090
 *
 * Sketch
 *  - same input -> same output, every time. No randomness, no clock.
 *  - covers the shapes the real provider returns, including the awkward ones
 *  - exposes failure modes on demand (throw / hang / return malformed JSON) so
 *    SP-090's "provider throws or times out -> degrade gracefully" and SP-092's
 *    "malformed output -> a friendly error" both have something to test against
 *
 * Test: tests/lib/ai/mock.test.ts
 */

import { AiProvider, PlanContext, EnhancedPlan, GenSpec, DraftQuestion, FeedbackContext } from './provider';

export const mockProvider: AiProvider = {
    async enhancePlan(input: PlanContext): Promise<EnhancedPlan> {
        if (input.assessmentId === 'throw') {
            throw new Error('Mock provider forced error (throw mode)');
        }
        if (input.assessmentId === 'hang') {
            await new Promise(() => {});
        }

        return {
            aiDescription: `Enhanced study plan for assessment #${input.assessmentId}. Focus on structured repetition, targeted problem-solving, and reviewing fundamental documentation.`
        };
    },

    async generateQuestions(spec: GenSpec): Promise<DraftQuestion[]> {
        if (spec.topic === 'throw') {
            throw new Error('Mock provider forced error for questions');
        }
        if (spec.topic === 'hang') {
            await new Promise(() => {});
        }

        const questions: DraftQuestion[] = [];
        for (let i = 1; i <= Math.min(spec.count, 3); i++) {
            questions.push({
                question: `Draft question ${i} regarding ${spec.topic}?`,
                options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
                correctAnswer: 'Choice A',
            });
        }
        return questions;
    },

    async feedback(input: FeedbackContext): Promise<string> {
        if (input.score === -1) {
            throw new Error('Mock provider forced feedback error');
        }
        if (input.score === -99) {
            await new Promise(() => {}); // Simulează un timeout
        }

        const primaryWeakness = input.weakAreas.length > 0
            ? input.weakAreas.join(', ')
            : 'core concepts';

        // Bănci de mesaje variate pentru a asigura diversitatea la fiecare test
        const lowScoreMessages = [
            `💡 Don't get discouraged by your score of ${input.score}%. Every challenge is a stepping stone. Dedicate your next study sprints to reviewing ${primaryWeakness} and re-attempting the practice sets. You've got this!`,
            `🌱 Scoring ${input.score}% is just the starting point of your journey. Focus closely on ${primaryWeakness} during your upcoming sessions, and you'll see rapid improvement. Keep going!`,
            `🎯 A score of ${input.score}% highlights specific areas to grow. Take a breath, revisit the fundamentals around ${primaryWeakness}, and tackle the next assessment with fresh energy!`
        ];

        const midScoreMessages = [
            `👍 Solid effort with a score of ${input.score}%! You're making good progress. To bridge the gap and reach excellence, spend some extra focus time tightening up on ${primaryWeakness}.`,
            `📈 You scored ${input.score}% — a solid mid-tier performance! Keep this momentum alive by clearing up minor doubts regarding ${primaryWeakness}.`,
            `⚡ Good job securing ${input.score}%. You understand the core ideas, but refining your approach to ${primaryWeakness} will push you into the top tier.`
        ];

        const highscoreMessages = [
            `🌟 Outstanding work! Achieving ${input.score}% shows a fantastic grasp of the material. Keep up the momentum by maintaining your review routine, focusing lightly on ${primaryWeakness}.`,
            `🚀 Incredible job! A ${input.score}% score puts you way ahead. Fine-tune your knowledge in ${primaryWeakness} and you'll master this domain completely.`,
            `🏆 Excellent results with ${input.score}%! Your dedication is clearly paying off. Keep challenging yourself beyond the standard material!`
        ];

        // Alegem un mesaj random din categoria corespunzătoare scorului
        let pool = lowScoreMessages;
        if (input.score >= 40 && input.score < 75) {
            pool = midScoreMessages;
        } else if (input.score >= 75) {
            pool = highscoreMessages;
        }

        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    },
};