/**
 * Tests for lib/domain/feedback.ts.
 *
 * Story: SP-093 (fallback path)
 *
 * Cases
 *  - the text names the actual weakest category and the actual score
 *  - a strong result gets a different message from a weak one
 *  - no weak areas -> still a complete, encouraging sentence
 *  - deterministic: same result -> same string
 *  - never empty, never a template placeholder leaking through
 *
 * And for weakAreasFromReview, which decides what "the actual weak areas" are:
 *  - correct answers contribute nothing
 *  - order is most fundamental first, then alphabetical, whatever the paper order
 *  - a repeated topic collapses to one entry
 *  - a run whose questions carry no topic degrades to difficulty bands
 */

import { describe, it, expect } from 'vitest';
import { buildFallbackFeedback, weakAreasFromReview } from '../../../lib/domain/feedback';
import type { ReviewItem, SkillLevel } from '../../../lib/domain/types';

function aReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
    return {
        position: 1,
        text: 'A question',
        difficulty: 'beginner',
        options: [],
        selectedAnswerId: null,
        correctAnswerId: 1,
        isCorrect: false,
        topicTitle: 'Indexes',
        studyAdvice: 'Read about B-trees.',
        ...overrides,
    };
}

/** One missed question on a topic, at a difficulty. The two facts that matter. */
function missed(topicTitle: string | null, difficulty: SkillLevel = 'beginner'): ReviewItem {
    return aReviewItem({ topicTitle, difficulty, isCorrect: false });
}

describe('weakAreasFromReview', () => {
    it('names only the topics the member got wrong', () => {
        const areas = weakAreasFromReview([
            aReviewItem({ topicTitle: 'Joins', isCorrect: true }),
            missed('Indexes'),
        ]);

        expect(areas).toEqual(['Indexes']);
    });

    it('is empty when nothing was missed', () => {
        expect(weakAreasFromReview([aReviewItem({ isCorrect: true })])).toEqual([]);
    });

    it('orders most fundamental first, then alphabetically', () => {
        const areas = weakAreasFromReview([
            missed('Sharding', 'advanced'),
            missed('Transactions', 'intermediate'),
            missed('Views', 'beginner'),
            missed('Indexes', 'beginner'),
        ]);

        expect(areas).toEqual(['Indexes', 'Views', 'Transactions', 'Sharding']);
    });

    it('does not depend on the order the paper happened to be in', () => {
        const paper = [
            missed('Sharding', 'advanced'),
            missed('Indexes', 'beginner'),
            missed('Transactions', 'intermediate'),
        ];

        expect(weakAreasFromReview(paper)).toEqual(weakAreasFromReview([...paper].reverse()));
    });

    it('collapses a repeated topic, keeping the more fundamental difficulty', () => {
        const areas = weakAreasFromReview([
            missed('Indexes', 'advanced'),
            missed('Indexes', 'beginner'),
            missed('Joins', 'intermediate'),
        ]);

        // One entry, and it sorts as a beginner topic — ahead of the
        // intermediate one — rather than as the advanced sighting.
        expect(areas).toEqual(['Indexes', 'Joins']);
    });

    it('falls back to difficulty bands when no question carries a topic', () => {
        // Category questions have no topic_title yet (ARCHITECTURE §3), so this
        // is the real shape of a non-baseline run, not a hypothetical one.
        const areas = weakAreasFromReview([
            missed(null, 'advanced'),
            missed(null, 'beginner'),
            aReviewItem({ topicTitle: null, difficulty: 'intermediate', isCorrect: true }),
        ]);

        expect(areas).toEqual(['beginner-level questions', 'advanced-level questions']);
    });

    it('ignores a topic that is only whitespace', () => {
        expect(weakAreasFromReview([missed('   ', 'beginner')])).toEqual([
            'beginner-level questions',
        ]);
    });
});

describe('buildFallbackFeedback', () => {
    it('names the actual score and the weakest area', () => {
        const text = buildFallbackFeedback({ score: 35 }, ['Indexes', 'Joins']);

        expect(text).toContain('35%');
        expect(text).toContain('Indexes');
    });

    it('rounds a fractional score rather than reading it out', () => {
        // 10 of 15 right is 66.666…, and total_score is numeric(5,2).
        const text = buildFallbackFeedback({ score: 66.67 }, ['Joins']);

        expect(text).toContain('67%');
        expect(text).not.toContain('66.67');
    });

    it('gives a strong result a different message from a weak one', () => {
        const weak = buildFallbackFeedback({ score: 20 }, ['Indexes']);
        const strong = buildFallbackFeedback({ score: 95 }, ['Indexes']);

        expect(weak).not.toEqual(strong);
    });

    it('changes message at each level boundary and not between them', () => {
        // The score itself is in the sentence, so two results in one band are
        // never byte-identical. Blanking the number leaves the template, which
        // is the thing that is supposed to change at 50 and at 80 — and those
        // are estimateLevel's boundaries, so they cannot drift from the level
        // shown on the member's own profile.
        const shape = (score: number) =>
            buildFallbackFeedback({ score }, ['Indexes']).replace(/\d+%/, 'N%');

        expect(shape(49)).toEqual(shape(0));
        expect(shape(50)).not.toEqual(shape(49));
        expect(shape(79)).toEqual(shape(50));
        expect(shape(80)).not.toEqual(shape(79));
    });

    it('still writes a complete sentence when there are no weak areas', () => {
        const text = buildFallbackFeedback({ score: 100 }, []);

        expect(text).toContain('100%');
        expect(text).toContain('the fundamentals');
        expect(text.trim().endsWith('.')).toBe(true);
    });

    it('names at most three areas, so the text stays advice and not a list', () => {
        const text = buildFallbackFeedback({ score: 40 }, ['A', 'B', 'C', 'D', 'E']);

        expect(text).toContain('A, B and C');
        expect(text).not.toContain('D');
    });

    it('joins two areas with "and", not a comma', () => {
        expect(buildFallbackFeedback({ score: 40 }, ['Indexes', 'Joins'])).toContain(
            'Indexes and Joins',
        );
    });

    it('is deterministic — the same result twice is the same string', () => {
        const once = buildFallbackFeedback({ score: 61 }, ['Indexes', 'Joins']);
        const twice = buildFallbackFeedback({ score: 61 }, ['Indexes', 'Joins']);

        expect(once).toEqual(twice);
    });

    it('never returns an empty string or leaks a placeholder', () => {
        for (const score of [0, 1, 49, 50, 79, 80, 99, 100]) {
            for (const areas of [[], ['Indexes'], ['Indexes', 'Joins', 'Views']]) {
                const text = buildFallbackFeedback({ score }, areas);

                expect(text.length).toBeGreaterThan(40);
                expect(text).not.toMatch(/undefined|null|NaN|\$\{|\[object/);
            }
        }
    });
});
