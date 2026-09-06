/**
 * Recommendation rules — pure and deterministic.
 *
 * Stories: SP-040, SP-060, SP-064, SP-065
 *
 * SP-060's generic plan generator lives here now. It used to be a sketch in
 * this comment while the only real builder was the baseline's, in baseline.ts,
 * and the note said the generic one would land "when category runs start
 * writing recommendations of their own". They do, so it has.
 *
 * The two are ONE function with a different sentence, which is what the split
 * was hiding: a missed question becomes a plan row the same way whichever paper
 * it came from — collapse duplicate topics, keep the most urgent, sort. Only
 * the phrase naming the run differs, so that is the only parameter.
 *
 * Same input twice -> byte-identical output. No Date.now(), no Math.random()
 * (SP-060 AC2).
 *
 * Test: tests/lib/domain/recommendations.test.ts
 */

import { WEAK_AREA_THRESHOLD } from './constants';
import type { SkillLevel } from './types';

/** A question the member got wrong or skipped, as the database describes it. */
export interface MissedQuestion {
    difficulty: SkillLevel;
    topicTitle: string | null;
    studyAdvice: string | null;
}

/** What one plan row needs. The service adds user, category and assessment ids. */
export interface PlanRecommendation {
    topicTitle: string;
    description: string;
    priority: number;
}

/** A wrong beginner answer is a bigger gap than a wrong advanced one. */
const PRIORITY_BY_DIFFICULTY: Record<SkillLevel, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
};

/**
 * The same scale, for a plan row this file did not build.
 *
 * `ai.service.draftPlan` writes rows whose TOPICS came from a model, and this
 * is what keeps their urgency from coming from one too: the model echoes back a
 * difficulty, which is a fact about the questions it was shown, and the number
 * is decided here as it is for every other row. Exported rather than
 * duplicated, so "a beginner gap outranks an advanced one" has one definition.
 */
export function priorityForDifficulty(difficulty: SkillLevel): number {
    return PRIORITY_BY_DIFFICULTY[difficulty];
}

/**
 * The phrase completing "…in your ___." for a category run.
 *
 * Its own function because two callers need the SAME sentence now: the builder
 * below, and grading.service, which passes it to the drafting prompt and into
 * the rule text of the rows that come back. A category whose title could not be
 * read says "last assessment" rather than inventing one.
 */
export function categoryRunLabel(categoryName: string | null): string {
    const name = categoryName?.trim();

    return name ? `${name} assessment` : 'last assessment';
}

/**
 * Missed questions in, plan rows out.
 *
 * `runLabel` completes the sentence "…in your ___." and is the only thing the
 * baseline and a category run disagree about. It is a phrase rather than a
 * name so the fallback can be honest: a category whose title could not be read
 * says "last assessment" rather than inventing one.
 *
 * Two rules worth stating out loud:
 *
 * 1. A question with no topic is SKIPPED, not invented. Questions written
 *    before topics were collected have none, so this degrades to fewer
 *    recommendations rather than to wrong ones — which is also why the admin
 *    form asks for the topic and the advice together or not at all.
 * 2. Two missed questions on the same topic collapse into ONE item, keeping the
 *    most urgent priority. The baseline's twenty topics are distinct, but a
 *    category bank is written by hand over months and a plan listing "Indexes"
 *    twice reads like a bug. It is also load-bearing now:
 *    `recommendation_plans_topic_unique` is UNIQUE (user, category, topic), so
 *    two rows for one topic is a failed insert, not a cosmetic problem.
 */
export function buildPlanRecommendations(
    missed: MissedQuestion[],
    runLabel: string,
): PlanRecommendation[] {
    const byTopic = new Map<string, PlanRecommendation>();

    for (const question of missed) {
        const topicTitle = question.topicTitle?.trim();
        const advice = question.studyAdvice?.trim();
        if (!topicTitle || !advice) continue;

        const priority = PRIORITY_BY_DIFFICULTY[question.difficulty];
        const existing = byTopic.get(topicTitle);

        if (!existing || priority < existing.priority) {
            byTopic.set(topicTitle, {
                topicTitle,
                description: `You missed the ${question.difficulty} question on this in your ${runLabel}. ${advice}`,
                priority,
            });
        }
    }

    // Priority first, then title — a stable, alphabetical tie-break rather than
    // Map insertion order, which would make the output depend on paper order.
    return [...byTopic.values()].sort(
        (a, b) => a.priority - b.priority || a.topicTitle.localeCompare(b.topicTitle),
    );
}

/**
 * A category run's plan (SP-060).
 *
 * The name is read from the category rather than passed down from the form, and
 * it may be missing: `grading.service` degrades a failed category read to null
 * rather than losing the plan over a headline. "your last assessment" is the
 * sentence a member gets in that case, which is true and says nothing wrong.
 */
export function buildCategoryRecommendations(
    missed: MissedQuestion[],
    categoryName: string | null,
): PlanRecommendation[] {
    return buildPlanRecommendations(missed, categoryRunLabel(categoryName));
}

/**
 * Should the assessments page recommend (re)taking a category the member
 * follows?
 *
 * Two signals, both from `category_progress`: no score yet — following a
 * category you have never been assessed in is exactly the gap an assessment
 * closes — or a score below the weak-area threshold, where a retake is how
 * progress on the plan becomes visible.
 *
 * Categories the member does not follow are never "recommended": there is no
 * evidence to recommend from. They still appear on the page as available.
 */
export function retakeRecommended(lastScore: number | null): boolean {
    return lastScore === null || lastScore < WEAK_AREA_THRESHOLD;
}
