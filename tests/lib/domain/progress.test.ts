import { describe, it, expect } from 'vitest';
import { completionRate, overallCompletion, type Completable, type CategoryCompletion } from '../../../lib/domain/progress';
import type { PlanStatus } from '../../../lib/domain/types';

describe('progress.ts domain logic', () => {
    describe('completionRate', () => {
        it('should return 0 for an empty items array', () => {
            expect(completionRate([])).toBe(0);
        });

        it('should calculate the correct rounded completion percentage', () => {
            const items: Completable[] = [
                { status: 'completed' },
                { status: 'completed' },
                { status: 'todo' as PlanStatus },
                { status: 'todo' as PlanStatus },
            ];
            // 2 out of 4 completed = 50%
            expect(completionRate(items)).toBe(50);
        });

        it('should handle 100% completion correctly', () => {
            const items: Completable[] = [
                { status: 'completed' },
                { status: 'completed' },
            ];
            expect(completionRate(items)).toBe(100);
        });

        it('should handle 0% completion correctly', () => {
            const items: Completable[] = [
                { status: 'todo' as PlanStatus },
                { status: 'todo' as PlanStatus },
            ];
            expect(completionRate(items)).toBe(0);
        });
    });

    describe('overallCompletion', () => {
        it('should return 0 if total items across all categories is 0', () => {
            expect(overallCompletion([])).toBe(0);
            expect(overallCompletion([{ completed: 0, total: 0 }])).toBe(0);
        });

        it('should pool items correctly across multiple categories rather than averaging percentages', () => {
            const byCategory: CategoryCompletion[] = [
                { completed: 1, total: 1 },
                { completed: 5, total: 10 },
            ];
            expect(overallCompletion(byCategory)).toBe(55);
        });

        it('should clamp nonsense values securely', () => {
            const byCategory: CategoryCompletion[] = [
                { completed: -5, total: 10 },
                { completed: 15, total: 10 },
            ];
            expect(overallCompletion(byCategory)).toBe(50);
        });
    });
});