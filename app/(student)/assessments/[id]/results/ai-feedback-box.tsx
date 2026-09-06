/**
 * The AI Feedback Assistant's block on the results page.
 *
 * Layer: PAGE (component)
 * Story: SP-093
 *
 * A SERVER component, and async, so the text can be awaited inside a
 * <Suspense> boundary while the rest of the page has already been sent. That is
 * ARCHITECTURE §6.2 — "the results page renders the rule-based plan
 * immediately; the AI text streams in" — expressed as the framework does it,
 * rather than as a client component that mounts, fires an effect and calls back
 * into the server for something the server already had.
 *
 * It has no error branch on purpose. feedbackFor never rejects and never
 * returns empty: a provider that is off, slow or broken produces the rule-based
 * text from lib/domain/feedback.ts instead, which is why SP-093 can promise a
 * page with no error banner on it.
 *
 * Test: covered through lib/services/ai.service.test.ts — the component is a
 * paragraph around one await, and the behaviour worth pinning is in the
 * service.
 */

import { feedbackFor } from '../../../../../lib/services/ai.service';
import type { AssessmentResults } from '../../../../../lib/services/grading.service';

interface AiFeedbackProps {
    userId: string;
    /** First name only. The prompt is allowed nothing else about them (SP-094). */
    firstName?: string;
    results: AssessmentResults;
}

export async function AiFeedback({ userId, firstName, results }: AiFeedbackProps) {
    const feedback = await feedbackFor(userId, {
        assessmentId: results.assessmentId,
        score: results.score,
        storedFeedback: results.aiFeedback,
        review: results.review,
        firstName,
    });

    return <p className="rise text-sm leading-relaxed text-foreground">{feedback}</p>;
}

/**
 * What sits in the box until the text arrives.
 *
 * Two lines at the width the real paragraph tends to occupy, so the block does
 * not resize under the reader when the answer lands. On a run whose feedback is
 * already stored this is never painted — there is nothing to wait for.
 */
export function AiFeedbackSkeleton() {
    return (
        <div className="space-y-2" aria-hidden="true">
            <div className="h-3.5 w-full animate-pulse rounded bg-surface-muted" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface-muted" />
        </div>
    );
}
