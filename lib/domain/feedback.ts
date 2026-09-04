/**
 * Rule-based feedback text — pure.
 *
 * Story: SP-093 (the fallback half of the AI Feedback Assistant)
 *
 * Sketch
 *  buildFallbackFeedback(result, weakAreas): string
 *   - specific, not "well done!": names the weakest category and the score
 *   - this is what renders when AI is disabled or the provider fails, and it
 *     must be good enough that a demo viewer cannot tell it is the fallback
 *
 * Keeping it pure means the whole AI feature degrades to something tested.
 *
 * Test: tests/lib/domain/feedback.test.ts
 */

export function buildFallbackFeedback(result: { score: number }, weakAreas: string[]): string
{
    const score = result.score;
    const weakestCategory = weakAreas.length > 0 ? weakAreas[0] : "general concepts";

    if (score >= 90)
    {
        return `🌟 Excellent performance! You achieved a score of ${score}% and showed great mastery. Focus on advanced edge cases in ${weakestCategory} to continue perfecting your skills.`;
    }
    else if (score >= 70)
    {
        return `💡 Good job! You secured a score of ${score}%. You have a solid grasp overall, but you should review a few concepts in ${weakestCategory} to reach the next level.`;
    }
    else
    {
        return `📈 You completed the assessment with a score of ${score}%. Learning is a continuous process—we recommend reviewing the foundational materials, especially for ${weakestCategory}.`;
    }
}