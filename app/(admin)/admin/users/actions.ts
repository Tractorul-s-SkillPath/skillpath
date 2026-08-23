/**
 * User admin actions.
 *
 * Layer: ACTION
 * Stories: SP-083, SP-014
 *
 * A Server Action is a public HTTP endpoint. That this one is only reachable
 * from a page behind app/(admin)/layout.tsx means nothing to somebody with
 * curl and a student's session cookie — so the admin check lives in the
 * service, and every path into it goes through assertAdmin() first. Before
 * that, any signed-in member could deactivate any account.
 *
 * Role changes are not here: promotion is scripts/promote-admin.sql (SP-015).
 *
 * Test: tests/app/(admin)/admin/users/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as userAdminService from '../../../../lib/services/user-admin.service';
import { formError, formSuccess, type FormState } from '../../../../lib/validation/common';

const statusSchema = z.object({
    userId: z.coerce.number().int().positive(),
    status: z.enum(['active', 'inactive']),
});

/**
 * The form posts the status it WANTS, not the one it currently sees.
 *
 * The first version posted `currentStatus` and flipped it on the server, which
 * makes the outcome depend on how stale the page is: a row deactivated in
 * another tab gets reactivated by a click that was meant to deactivate it.
 * Sending the target makes the action idempotent — two clicks land on the same
 * state instead of toggling twice.
 */
export async function setUserStatusAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = statusSchema.safeParse({
        userId: formData.get('userId'),
        status: formData.get('status'),
    });

    if (!parsed.success) return formError('That change could not be applied.');

    const result = await userAdminService.setUserStatus(parsed.data.userId, parsed.data.status);

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath('/admin/users');

    return formSuccess(parsed.data.status === 'active' ? 'Account activated.' : 'Account deactivated.');
}
