import { describe, it, expect } from 'vitest';
import { buildBaselineRecommendations, bandBreakdown, MissedQuestion } from '../../../lib/domain/baseline';

describe('baseline.ts domain logic', () => {
    describe('buildBaselineRecommendations', () => {
        it('should return empty array if no missed questions are provided', () => {
            const result = buildBaselineRecommendations([]);
            expect(result).toEqual([]);
        });

        it('should skip questions with missing topicTitle or studyAdvice', () => {
            const missed: MissedQuestion[] = [
                { difficulty: 'beginner', topicTitle: null, studyAdvice: 'Some advice' },
                { difficulty: 'beginner', topicTitle: 'Git', studyAdvice: null },
                { difficulty: 'beginner', topicTitle: '   ', studyAdvice: '   ' },
            ];
            const result = buildBaselineRecommendations(missed);
            expect(result).toEqual([]);
        });

        it('should build recommendations correctly and assign priorities based on difficulty', () => {
            const missed: MissedQuestion[] = [
                { difficulty: 'advanced', topicTitle: 'Docker', studyAdvice: 'Learn containers.' },
                { difficulty: 'beginner', topicTitle: 'React', studyAdvice: 'Learn components.' },
            ];

            const result = buildBaselineRecommendations(missed);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                topicTitle: 'React',
                description: 'You missed the beginner question on this in your baseline assessment. Learn components.',
                priority: 1,
            });
            expect(result[1]).toEqual({
                topicTitle: 'Docker',
                description: 'You missed the advanced question on this in your baseline assessment. Learn containers.',
                priority: 3,
            });
        });

        it('should collapse multiple missed questions on the same topic keeping the most urgent priority', () => {
            const missed: MissedQuestion[] = [
                { difficulty: 'advanced', topicTitle: 'Git', studyAdvice: 'Advanced git advice.' },
                { difficulty: 'beginner', topicTitle: 'Git', studyAdvice: 'Beginner git advice.' },
            ];

            const result = buildBaselineRecommendations(missed);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                topicTitle: 'Git',
                description: 'You missed the beginner question on this in your baseline assessment. Beginner git advice.',
                priority: 1,
            });
        });

        it('should sort recommendations stably by priority then alphabetically by title', () => {
            const missed: MissedQuestion[] = [
                { difficulty: 'beginner', topicTitle: 'Zebra', studyAdvice: 'Advice Z.' },
                { difficulty: 'beginner', topicTitle: 'Apple', studyAdvice: 'Advice A.' },
                { difficulty: 'intermediate', topicTitle: 'Docker', studyAdvice: 'Advice D.' },
            ];

            const result = buildBaselineRecommendations(missed);

            expect(result).toHaveLength(3);
            expect(result[0].topicTitle).toBe('Apple');
            expect(result[1].topicTitle).toBe('Zebra');
            expect(result[2].topicTitle).toBe('Docker');
        });
    });

    describe('bandBreakdown', () => {
        it('should correctly calculate scores for all three difficulty bands', () => {
            const rows = [
                { difficulty: 'beginner' as const, isCorrect: true },
                { difficulty: 'beginner' as const, isCorrect: false },
                { difficulty: 'beginner' as const, isCorrect: true },
                { difficulty: 'intermediate' as const, isCorrect: false },
                { difficulty: 'advanced' as const, isCorrect: true },
            ];

            const result = bandBreakdown(rows);

            expect(result).toEqual([
                { difficulty: 'beginner', correct: 2, total: 3 },
                { difficulty: 'intermediate', correct: 0, total: 1 },
                { difficulty: 'advanced', correct: 1, total: 1 },
            ]);
        });

        it('should handle empty rows gracefully with zero counts', () => {
            const result = bandBreakdown([]);

            expect(result).toEqual([
                { difficulty: 'beginner', correct: 0, total: 0 },
                { difficulty: 'intermediate', correct: 0, total: 0 },
                { difficulty: 'advanced', correct: 0, total: 0 },
            ]);
        });
    });
});