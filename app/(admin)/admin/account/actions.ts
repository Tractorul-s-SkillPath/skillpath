/**
 * Admin account actions.
 *
 * Layer: ACTION — assertAdmin -> zod.parse -> service -> revalidate (§3)
 *
 * WHY NOT JUST IMPORT THE PROFILE ONE
 *
 * `app/(student)/profile/actions.ts` already has an `updateNameAction` that
 * would work — it takes the user id from the session and calls the same
 * service. Importing it here would still be wrong on two counts: the guard
 * would be assertAuth (any member) on a page that is supposed to be
 * admin-only, and its revalidate targets `/profile`, a route an admin now
 * never sees. Actions live beside the page they serve (§3), so this is a
 * twenty-line sibling rather than a shared import with two callers wanting
 * different guards.
 *
 * The service call underneath is identical, which is the part that matters:
 * there is still one implementation of "rename a user".
 */

'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '../../../../lib/auth/assertAdmin';
import * as profileService from '../../../../lib/services/profile.service';
import { nameSchema } from '../../../../lib/validation/profile.schema';
import {
    fieldErrors,
    formError,
    formSuccess,
    type FormState,
} from '../../../../lib/validation/common';

export async function updateAdminNameAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    // The id comes from the session, never from the form (§5) — a Server
    // Action is a public endpoint no matter which page renders it.
    const admin = await assertAdmin();

    const parsed = nameSchema.safeParse({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName') ?? '',
    });

    if (!parsed.success) {
        return formError('Check the fields below.', fieldErrors(parsed.error));
    }

    const result = await profileService.updateName(
        admin.userId,
        parsed.data.firstName,
        parsed.data.lastName,
    );

    if (!result.ok) {
        return formError(result.error.message, result.error.fields);
    }

    revalidatePath('/admin/account');
    // The admin header prints the name too, so the layout has to re-render or
    // a rename shows on the page and not in the bar above it.
    revalidatePath('/', 'layout');

    return formSuccess('Name updated.');
}
