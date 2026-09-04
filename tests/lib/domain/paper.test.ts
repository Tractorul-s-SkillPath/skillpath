import { describe, it, expect } from 'vitest';
import { drawPaper } from '../../../lib/domain/paper';

describe('paper.ts domain logic', () => {
    describe('drawPaper', () => {
        it('should shuffle and slice the question ids up to the requested size', () => {
            const ids = [1, 2, 3, 4, 5];
            // Mock random returning a constant value to test determinism
            const mockRandom = () => 0.5;

            const result = drawPaper(ids, 3, mockRandom);

            expect(result).toHaveLength(3);
            result.forEach((id) => {
                expect(ids).toContain(id);
            });
        });

        it('should return the whole bank shuffled if size is greater than the bank length', () => {
            const ids = [1, 2, 3];
            const mockRandom = () => 0.1;

            const result = drawPaper(ids, 10, mockRandom);

            expect(result).toHaveLength(3);
            expect(result.sort()).toEqual([1, 2, 3]);
        });

        it('should not mutate the original input array', () => {
            const ids = [1, 2, 3, 4, 5];
            const original = [...ids];

            drawPaper(ids, 3, () => 0.5);

            expect(ids).toEqual(original);
        });

        it('should return an empty array if size is 0 or negative', () => {
            const ids = [1, 2, 3];

            expect(drawPaper(ids, 0)).toEqual([]);
            expect(drawPaper(ids, -5)).toEqual([]);
        });
    });
});
