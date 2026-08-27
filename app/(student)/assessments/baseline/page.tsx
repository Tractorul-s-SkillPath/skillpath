/**
 * The baseline's front door — the URL the dashboard card opens in a new tab.
 *
 * Layer: PAGE
 * Story: SP-112
 *
 * Renders nothing. Find-or-create in the service, then a redirect to wherever
 * the member belongs: their in-progress run, a fresh one, or — if the attempt
 * is already spent — the results. A stable URL to a moving target, so the
 * dashboard never needs to know an assessment id.
 */

import { redirect } from 'next/navigation';
import { assertAuth } from '../../../../lib/auth/assertAuth';
import { startBaseline } from '../../../../lib/services/assessment.service';

export const metadata = { title: 'Baseline assessment · SkillPath' };
export const dynamic = 'force-dynamic';

export default async function BaselinePage() {
    const user = await assertAuth();
    const started = await startBaseline(user.userId);

    if (!started.ok) {
        // Nothing to render here and nothing the member can fix; the dashboard
        // is where the card (and its explanations) live.
        redirect('/dashboard');
    }

    redirect(
        started.value.kind === 'results'
            ? `/assessments/${started.value.assessmentId}/results`
            : `/assessments/${started.value.assessmentId}`,
    );
}
