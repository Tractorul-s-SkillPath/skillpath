/**
 * The baseline paper's rules — pure.
 *
 * Stories: SP-116, SP-117
 *
 * WHERE THE ADVICE LIVES: in the database, on the question — `topic_title` and
 * `study_advice`, added by migration 0004. It used to be an array in this file
 * keyed by PAPER POSITION, which worked only while the paper was one fixed
 * sequence: draw questions at random, or let an admin insert one, and position
 * 11 becomes a different question while the advice for it stays put. A member
 * would be told to study something they were never asked about.
 *
 * WHERE THE BUILDING NOW HAPPENS: recommendations.ts. Collapsing duplicate
 * topics, ranking them and phrasing the sentence were never baseline rules —
 * they are how a missed question becomes a plan row on any paper — and keeping
 * a private copy here would have meant a category plan that drifts from the
 * baseline's one fix at a time. What is left is the baseline's own noun for
 * itself, and the band breakdown, which only the fixed twenty-question paper
 * has.
 *
 * Same input twice -> byte-identical output. No Date.now(), no Math.random()
 * (SP-060 AC2 applies here as much as to the category plans).
 *
 * Test: tests/lib/domain/baseline.test.ts
 */

import {
    buildPlanRecommendations,
    type MissedQuestion,
    type PlanRecommendation,
} from './recommendations';
import type { SkillLevel } from './types';

export type { MissedQuestion } from './recommendations';

/** The baseline's rows are ordinary plan rows. Kept as a name so callers read clearly. */
export type BaselineRecommendation = PlanRecommendation;

/**
 * The baseline paper's plan.
 *
 * One attempt, one paper, one phrase: "your baseline assessment" is a thing a
 * member can point at, unlike a category run they may have taken three times.
 * Everything else is the generic builder.
 */
export function buildBaselineRecommendations(missed: MissedQuestion[]): BaselineRecommendation[] {
    return buildPlanRecommendations(missed, 'baseline assessment');
}

/** "6/7 beginner, 4/7 intermediate, 1/6 advanced" — the number that tells a member where to start. */
export interface BandScore {
    difficulty: SkillLevel;
    correct: number;
    total: number;
}

export function bandBreakdown(
    rows: Array<{ difficulty: SkillLevel; isCorrect: boolean }>,
): BandScore[] {
    const order: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

    return order.map((difficulty) => {
        const inBand = rows.filter((r) => r.difficulty === difficulty);
        return {
            difficulty,
            correct: inBand.filter((r) => r.isCorrect).length,
            total: inBand.length,
        };
    });
}
