/**
 * Plan actions.
 *
 * Layer: ACTION — assertAuth -> zod.parse -> service -> revalidate (§3)
 * Story: SP-063
 *
 * The user id comes from the session, never the form. The update writes
 * progress_status and nothing else — topic_title and priority are not in the
 * schema, so a crafted POST cannot rewrite an item (SP-063 AC3).
 */

'use server';

import { revalidatePath } from 'next/cache';
import { assertAuth } from '../../../lib/auth/assertAuth';
import * as planService from '../../../lib/services/plan.service';
import { planStatusSchema } from '../../../lib/validation/plan.schema';
import { formError, formSuccess, type FormState } from '../../../lib/validation/common';

export async function updatePlanStatusAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const user = await assertAuth();

    const parsed = planStatusSchema.safeParse({
        recommendationId: formData.get('recommendationId'),
        status: formData.get('status'),
    });

    if (!parsed.success) return formError('That change could not be applied.');

    const result = await planService.setItemStatus(
        user.userId,
        parsed.data.recommendationId,
        parsed.data.status,
    );

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath('/plan');
    // Completing an item pays XP, and the dashboard's tiles and per-category
    // bars all read the plan — the header re-renders via the layout.
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');

    return formSuccess(parsed.data.status === 'completed' ? 'Done — XP updated.' : 'Updated.');
}
