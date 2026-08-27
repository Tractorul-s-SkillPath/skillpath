/**
 * The assessment run.
 *
 * Layer: PAGE
 * Stories: SP-043, SP-044, SP-045, SP-113, SP-114
 *
 * Server component: reads the pre-created responses in position order and
 * hands them to the runner as initial state, which is the whole refresh story —
 * the server is the session, so a hard refresh reproduces the same paper with
 * the same selections and the same deadline (SP-044). Nothing in localStorage.
 *
 * A run whose clock ran out while the tab was closed is submitted HERE, on
 * read, before redirecting to the results. profile.service writes badge awards
 * during render on the same reasoning: the state the member is owed and the
 * state in the database should converge on every read, not only on a click.
 */

import { notFound, redirect } from 'next/navigation';
import { assertAuth } from '../../../../lib/auth/assertAuth';
import { getRun } from '../../../../lib/services/assessment.service';
import { submit } from '../../../../lib/services/grading.service';
import { hasExpired, remainingSeconds } from '../../../../lib/domain/timer';
import { TIMER_GRACE_SECONDS } from '../../../../lib/domain/constants';
import { AssessmentRunner } from './assessment-runner';

export const metadata = { title: 'Assessment · SkillPath' };
export const dynamic = 'force-dynamic';

export default async function AssessmentRunPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const user = await assertAuth();

    const { id } = await params;
    const assessmentId = Number.parseInt(id, 10);
    if (!Number.isFinite(assessmentId)) notFound();

    const run = await getRun(user.userId, assessmentId);
    if (!run.ok) notFound();

    if (run.value.status !== 'in_progress') {
        redirect(`/assessments/${assessmentId}/results`);
    }

    const { startedAt, timeLimitSeconds } = run.value;

    if (hasExpired(startedAt, timeLimitSeconds + TIMER_GRACE_SECONDS, new Date())) {
        // Whatever was answered counts; grading treats the rest as wrong.
        await submit(user.userId, assessmentId);
        redirect(`/assessments/${assessmentId}/results`);
    }

    return (
        <AssessmentRunner
            assessmentId={run.value.assessmentId}
            questions={run.value.questions}
            // The deadline travels as seconds-remaining measured by the SERVER
            // clock, so a wrong client clock shifts the display, not the paper.
            initialRemainingSeconds={remainingSeconds(startedAt, timeLimitSeconds, new Date())}
        />
    );
}
