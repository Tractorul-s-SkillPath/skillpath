/**
 * Recommendation rules — pure and deterministic.
 *
 * Stories: SP-040, SP-060, SP-064, SP-065
 *
 * What exists: the rule for which categories the assessments page should push
 * a member toward. What is still a sketch: buildPlan(weakAreas, level,
 * catalog) — the generic plan generator (SP-060). The baseline's plan is built
 * by lib/domain/baseline.ts; the generic one lands when category runs start
 * writing recommendations of their own.
 *
 * Test: tests/lib/domain/recommendations.test.ts
 */

import { WEAK_AREA_THRESHOLD } from './constants';

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
