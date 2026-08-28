/**
 * A category's front door — the URL the assessments list opens in a new tab.
 *
 * Layer: PAGE
 * Stories: SP-040, SP-041, SP-042
 *
 * The exact shape of /assessments/baseline, for the categories: renders
 * nothing, find-or-create in the service, then redirect to the run. A stable
 * URL to a moving target, so the list never needs to know an assessment id.
 *
 * WHY A ROUTE AND NOT THE SERVER ACTION IT REPLACES
 *
 * The run has to open in a NEW TAB, and only a real link can do that: a Server
 * Action resolves in the tab that posted it, and window.open() after an await
 * is no longer inside the user gesture, so popup blockers eat it. A plain <a
 * target="_blank"> — not next/link, which would prefetch this and start runs
 * nobody asked for — is the one thing that reliably opens a tab on a click.
 *
 * So this is a GET that writes, which the layer rule normally forbids. What
 * makes it safe is that it is not idempotent by accident but BY DESIGN:
 * startCategory() resumes an open run rather than creating a second, so a
 * double-click, a refresh or a restored tab all land in the same paper. It
 * re-checks the category and the bank for the same reason the action did —
 * this URL is as public as any other.
 */

import { redirect } from 'next/navigation';
import { assertAuth } from '../../../../../lib/auth/assertAuth';
import { startCategory } from '../../../../../lib/services/assessment.service';
import { startSchema } from '../../../../../lib/validation/assessment.schema';

export const metadata = { title: 'Starting assessment · SkillPath' };
export const dynamic = 'force-dynamic';

export default async function StartCategoryPage({
    params,
}: {
    params: Promise<{ categoryId: string }>;
}) {
    const user = await assertAuth();

    const { categoryId } = await params;

    // The same schema the Server Action this route replaced used to parse, and
    // for the same reason — the id arrives from outside. `positive()` also
    // rejects the baseline's sentinel 0, which starts through its own door.
    const parsed = startSchema.safeParse({ categoryId });

    // Nothing to render here and nothing the member can fix in this tab: the
    // list is where a category's real state (and the reason it is unavailable)
    // is already spelled out.
    if (!parsed.success) redirect('/assessments');

    const started = await startCategory(user.userId, parsed.data.categoryId);
    if (!started.ok) redirect('/assessments');

    redirect(`/assessments/${started.value}`);
}
