/**
 * Tests for lib/domain/recommendations.ts.
 *
 * Stories: SP-040, SP-060, SP-064, SP-065
 *
 * SP-060's builder lives here now, so this file covers both: the generic engine
 * that turns missed questions into plan rows, and the category wrapper that
 * names the run. The baseline's own wrapper is tested next door, in
 * baseline.test.ts, against the exact sentence a member reads — the two files
 * pin the same function from both ends deliberately, because the sentence is
 * the part a refactor can quietly change.
 *
 * The threshold is imported rather than typed out: constants.ts asks that these
 * numbers are never inlined anywhere, tests included, and a test that hardcodes
 * 60 keeps passing after someone moves the constant to 65.
 */

import { describe, it, expect } from 'vitest';
import {
    buildCategoryRecommendations,
    buildPlanRecommendations,
    retakeRecommended,
    type MissedQuestion,
} from '../../../lib/domain/recommendations';
import { WEAK_AREA_THRESHOLD } from '../../../lib/domain/constants';

const aMissed = (overrides: Partial<MissedQuestion> = {}): MissedQuestion => ({
    difficulty: 'beginner',
    topicTitle: 'Indexes',
    studyAdvice: 'Reread how a B-tree is maintained on insert.',
    ...overrides,
});

describe('buildPlanRecommendations', () => {
    it('turns a missed question into one row naming the run', () => {
        const [item] = buildPlanRecommendations([aMissed()], 'Databases assessment');

        expect(item.topicTitle).toBe('Indexes');
        expect(item.description).toBe(
            'You missed the beginner question on this in your Databases assessment. ' +
                'Reread how a B-tree is maintained on insert.',
        );
    });

    it('skips a question with no topic instead of inventing one', () => {
        // Fewer recommendations, never wrong ones. The bank written before the
        // form asked for topics is entirely this case.
        expect(
            buildPlanRecommendations([aMissed({ topicTitle: null })], 'Databases assessment'),
        ).toEqual([]);
    });

    it('skips a topic whose advice is missing, which would print a bare sentence', () => {
        expect(
            buildPlanRecommendations([aMissed({ studyAdvice: null })], 'Databases assessment'),
        ).toEqual([]);
    });

    it('collapses two misses on one topic into a single row', () => {
        // Not cosmetic: recommendation_plans_topic_unique is UNIQUE on
        // (user, category, topic), so two rows here is a failed insert.
        const items = buildPlanRecommendations(
            [aMissed({ difficulty: 'advanced' }), aMissed({ difficulty: 'beginner' })],
            'Databases assessment',
        );

        expect(items).toHaveLength(1);
    });

    it('keeps the most urgent difficulty when a topic is missed twice', () => {
        const items = buildPlanRecommendations(
            [aMissed({ difficulty: 'advanced' }), aMissed({ difficulty: 'beginner' })],
            'Databases assessment',
        );

        expect(items[0].priority).toBe(1);
        expect(items[0].description).toContain('beginner');
    });

    it('orders by urgency, then alphabetically, whatever order the paper was in', () => {
        const items = buildPlanRecommendations(
            [
                aMissed({ topicTitle: 'Views', difficulty: 'intermediate' }),
                aMissed({ topicTitle: 'Joins', difficulty: 'intermediate' }),
                aMissed({ topicTitle: 'Indexes', difficulty: 'beginner' }),
            ],
            'Databases assessment',
        );

        expect(items.map((item) => item.topicTitle)).toEqual(['Indexes', 'Joins', 'Views']);
    });

    it('is deterministic — the same misses in any order give the same plan', () => {
        const misses = [
            aMissed({ topicTitle: 'Views', difficulty: 'advanced' }),
            aMissed({ topicTitle: 'Joins' }),
        ];

        expect(buildPlanRecommendations(misses, 'x assessment')).toEqual(
            buildPlanRecommendations([...misses].reverse(), 'x assessment'),
        );
    });
});

describe('buildCategoryRecommendations', () => {
    it('names the category the member has just been assessed in', () => {
        const [item] = buildCategoryRecommendations([aMissed()], 'Databases');

        expect(item.description).toContain('in your Databases assessment.');
    });

    it('falls back to a true sentence when the category name could not be read', () => {
        // grading.service degrades a failed category read to null rather than
        // losing the plan over a headline, so this is a real input.
        const [item] = buildCategoryRecommendations([aMissed()], null);

        expect(item.description).toContain('in your last assessment.');
    });

    it('treats a blank name as no name at all', () => {
        const [item] = buildCategoryRecommendations([aMissed()], '   ');

        expect(item.description).toContain('in your last assessment.');
    });
});

describe('retakeRecommended', () => {
    it('recommends a category the member has never been assessed in', () => {
        // Following a category with no score is exactly the gap an assessment
        // closes, so absence of evidence is itself the signal here.
        expect(retakeRecommended(null)).toBe(true);
    });

    it('recommends a category scored below the weak-area threshold', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD - 1)).toBe(true);
        expect(retakeRecommended(0)).toBe(true);
    });

    it('stops recommending exactly at the threshold, not one point past it', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD)).toBe(false);
    });

    it('leaves a comfortably passed category alone', () => {
        expect(retakeRecommended(WEAK_AREA_THRESHOLD + 1)).toBe(false);
        expect(retakeRecommended(100)).toBe(false);
    });
});
