/**
 * Rule-based feedback text — pure.
 *
 * Story: SP-093 (the fallback half of the AI Feedback Assistant)
 *
 * Sketch
 *  weakAreasFromReview(review): string[]
 *   - what the member actually got wrong, most fundamental first. This is the
 *     ONLY thing the prompt is allowed to say about them beyond a first name
 *     and a score (SP-094), so it is computed here rather than assembled ad hoc
 *     next to the provider call.
 *  buildFallbackFeedback(result, weakAreas): string
 *   - specific, not "well done!": names the weakest area and the score
 *   - this is what renders when AI is disabled or the provider fails, and it
 *     must be good enough that a demo viewer cannot tell it is the fallback
 *
 * Keeping it pure means the whole AI feature degrades to something tested.
 *
 * Test: tests/lib/domain/feedback.test.ts
 */

import { estimateLevel } from './levels';
import type { ReviewItem, SkillLevel } from './types';

/** Most fundamental first. A missed beginner question outranks a missed advanced one. */
const DIFFICULTY_RANK: Record<SkillLevel, number> = {
    beginner: 0,
    intermediate: 1,
    advanced: 2,
};

const DIFFICULTIES: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

/**
 * The topics behind the questions this run got wrong, worst first.
 *
 * Two rules, both borrowed from buildBaselineRecommendations in baseline.ts,
 * because a member should not be told one thing by their plan and another by
 * their feedback:
 *
 *  1. A topic seen twice collapses to one entry, keeping the more fundamental
 *     difficulty — "Git workflow" listed twice reads like a bug.
 *  2. Order is difficulty then title, so the same run always produces the same
 *     list regardless of paper order.
 *
 * WHEN THERE ARE NO TOPICS. Only the baseline paper's questions carry
 * `topic_title` today (ARCHITECTURE §3); a category run's do not. Rather than
 * hand the prompt an empty list and get generic praise back — exactly what
 * SP-093 rules out — it degrades to the difficulty bands the member actually
 * lost marks in, which is still a true, specific statement about this run.
 */
export function weakAreasFromReview(review: ReviewItem[]): string[] {
    const missed = review.filter((item) => !item.isCorrect);

    const hardestByTopic = new Map<string, SkillLevel>();

    for (const item of missed) {
        const title = item.topicTitle?.trim();
        if (!title) continue;

        const seen = hardestByTopic.get(title);
        if (!seen || DIFFICULTY_RANK[item.difficulty] < DIFFICULTY_RANK[seen]) {
            hardestByTopic.set(title, item.difficulty);
        }
    }

    if (hardestByTopic.size > 0) {
        return [...hardestByTopic.entries()]
            .sort(
                ([titleA, levelA], [titleB, levelB]) =>
                    DIFFICULTY_RANK[levelA] - DIFFICULTY_RANK[levelB] ||
                    titleA.localeCompare(titleB),
            )
            .map(([title]) => title);
    }

    const missedBands = new Set(missed.map((item) => item.difficulty));
    return DIFFICULTIES.filter((level) => missedBands.has(level)).map(
        (level) => `${level}-level questions`,
    );
}

/**
 * At most this many areas are named in one sentence. Past three the text stops
 * being advice and becomes a list, and the member has a plan page for that.
 */
const MAX_AREAS_NAMED = 3;

/** "Indexes", "Indexes and Joins", "Indexes, Joins and Git workflow". */
function nameThem(weakAreas: string[]): string {
    const named = weakAreas.slice(0, MAX_AREAS_NAMED);

    if (named.length === 0) return 'the fundamentals';
    if (named.length === 1) return named[0];

    return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

/**
 * The text that renders when there is no AI.
 *
 * Deterministic on purpose — no Date.now(), no Math.random(). SP-093 asks that
 * the same result always shows the same text, and a fallback that reshuffled
 * itself on every refresh would break that promise on exactly the days the
 * provider is down.
 *
 * The score is rounded for display only. `total_score` is numeric(5,2) and a
 * 15-question paper produces 66.67, which no one wants read back to them.
 *
 * Which of the three messages a member gets is decided by estimateLevel, not by
 * numbers written out here. The tone of the feedback and the level on their
 * profile then agree by construction, and the 50/80 boundaries stay in
 * lib/domain/constants.ts where the SQL mirrors them.
 */
export function buildFallbackFeedback(result: { score: number }, weakAreas: string[]): string {
    const score = Math.round(result.score);
    const areas = nameThem(weakAreas);

    switch (estimateLevel(result.score)) {
        case 'advanced':
            return (
                `You scored ${score}% — a strong result, and it shows in how few gaps are left. ` +
                `Keep the edge by pushing into the harder end of ${areas}, where the last few marks are.`
            );

        case 'intermediate':
            return (
                `You scored ${score}%, so the core ideas are there. The quickest way up from here ` +
                `is ${areas} — work through that before taking anything new on.`
            );

        default:
            return (
                `You scored ${score}%. That is a starting point, not a verdict, and it is a ` +
                `specific one: ${areas} is where this run came apart. Start there, one topic at ` +
                `a time, and take it again.`
            );
    }
}
