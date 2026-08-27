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
 * So what is left here is what is genuinely a rule rather than content:
 * how urgent a missed question is, how duplicates collapse, and how the
 * sentence is phrased. Editing the advice itself is now a database change (or,
 * later, an admin screen) and needs no deploy.
 *
 * Same input twice -> byte-identical output. No Date.now(), no Math.random()
 * (SP-060 AC2 applies here as much as to the category plans).
 *
 * Test: none yet — by team decision tests land in week 3.
 */

import type { SkillLevel } from './types';

/** A question the member got wrong or skipped, as the database describes it. */
export interface MissedQuestion {
    difficulty: SkillLevel;
    topicTitle: string | null;
    studyAdvice: string | null;
}

/** What one plan row needs. The service adds user, category and assessment ids. */
export interface BaselineRecommendation {
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
 * Missed questions in, plan rows out.
 *
 * Two rules worth stating out loud:
 *
 * 1. A question with no topic is SKIPPED, not invented. Every question outside
 *    the baseline paper has no topic yet, so this degrades to fewer
 *    recommendations rather than to wrong ones.
 * 2. Two missed questions on the same topic collapse into ONE item, keeping the
 *    most urgent priority. Nothing produces that today — the twenty topics are
 *    distinct — but randomisation will, and a plan listing "Git workflow"
 *    twice reads like a bug.
 */
export function buildBaselineRecommendations(missed: MissedQuestion[]): BaselineRecommendation[] {
    const byTopic = new Map<string, BaselineRecommendation>();

    for (const question of missed) {
        const topicTitle = question.topicTitle?.trim();
        const advice = question.studyAdvice?.trim();
        if (!topicTitle || !advice) continue;

        const priority = PRIORITY_BY_DIFFICULTY[question.difficulty];
        const existing = byTopic.get(topicTitle);

        if (!existing || priority < existing.priority) {
            byTopic.set(topicTitle, {
                topicTitle,
                description: `You missed the ${question.difficulty} question on this in your baseline assessment. ${advice}`,
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
