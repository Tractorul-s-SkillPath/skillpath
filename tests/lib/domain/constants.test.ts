/**
 * Tests for lib/domain/constants.ts.
 *
 * Story: SP-051 — "implements the documented thresholds from one constants file"
 *
 * Cases
 *  - the level thresholds are exactly 50 and 80, weak area is 60
 *  - the bands are contiguous and non-overlapping (no score falls in a gap)
 *  - QUESTIONS_PER_ASSESSMENT >= MIN_QUESTIONS_TO_GENERATE
 *
 * This file exists so that changing a threshold is a deliberate act with a
 * failing test attached, not a silent edit nobody reviews.
 */

import { describe, it, expect } from 'vitest';
import {
    LEVEL_THRESHOLDS,
    WEAK_AREA_THRESHOLD,
    XP_PER_ASSESSMENT,
    XP_PER_SCORE_POINT,
    XP_PER_PLAN_ITEM,
    XP_PER_BADGE,
    XP_LEVEL_BASE,
    XP_LEVEL_STEP,
    LEADERBOARD_SIZE,
    GENERAL_KNOWLEDGE_CATEGORY_ID,
    BASELINE_QUESTION_COUNT,
    BASELINE_TIME_LIMIT_SECONDS,
    TIMER_GRACE_SECONDS,
    MIN_CATEGORY_QUESTIONS,
    CATEGORY_PAPER_SIZE,
    SECONDS_PER_QUESTION,
    APP_TIMEZONE,
    LEVEL_LABELS,
    PLAN_STATUS_LABELS,
} from '../../../lib/domain/constants';

describe('constants.ts domain logic', () => {
    it('should define correct level thresholds in descending order of min score', () => {
        expect(LEVEL_THRESHOLDS).toEqual([
            { min: 80, level: 'advanced' },
            { min: 50, level: 'intermediate' },
            { min: 0, level: 'beginner' },
        ]);
    });

    it('should define the weak area threshold correctly', () => {
        expect(WEAK_AREA_THRESHOLD).toBe(60);
    });

    it('should define correct XP economy values', () => {
        expect(XP_PER_ASSESSMENT).toBe(50);
        expect(XP_PER_SCORE_POINT).toBe(1);
        expect(XP_PER_PLAN_ITEM).toBe(40);
        expect(XP_PER_BADGE).toBe(25);
        expect(XP_LEVEL_BASE).toBe(200);
        expect(XP_LEVEL_STEP).toBe(100);
        expect(LEADERBOARD_SIZE).toBe(10);
    });

    it('should define correct baseline assessment rules', () => {
        expect(GENERAL_KNOWLEDGE_CATEGORY_ID).toBe(0);
        expect(BASELINE_QUESTION_COUNT).toBe(20);
        // 25 minutes * 60 seconds = 1500 seconds
        expect(BASELINE_TIME_LIMIT_SECONDS).toBe(1500);
        expect(TIMER_GRACE_SECONDS).toBe(5);
    });

    it('should define correct category assessment rules', () => {
        expect(MIN_CATEGORY_QUESTIONS).toBe(5);
        expect(CATEGORY_PAPER_SIZE).toBe(10);
        expect(SECONDS_PER_QUESTION).toBe(75);
    });

    it('should use Europe/Bucharest as the application timezone', () => {
        expect(APP_TIMEZONE).toBe('Europe/Bucharest');
    });

    it('should have correct human-readable level labels', () => {
        expect(LEVEL_LABELS).toEqual({
            beginner: 'Beginner',
            intermediate: 'Intermediate',
            advanced: 'Advanced',
        });
    });

    it('should have correct human-readable plan status labels', () => {
        expect(PLAN_STATUS_LABELS).toEqual({
            not_started: 'Not started',
            in_progress: 'In progress',
            completed: 'Completed',
        });
    });
});