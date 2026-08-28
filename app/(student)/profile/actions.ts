/**
 * Profile server actions.
 *
 * Layer: ACTION — assertAuth -> zod.parse -> service -> revalidate (§3)
 * Stories: SP-021, SP-022
 *
 * Every one starts with assertAuth() and takes the user id from the session,
 * NEVER from the form (§5). A Server Action is a public HTTP endpoint: that it
 * is only called from a page behind middleware means nothing to somebody with
 * curl — and with no RLS underneath, this is the only ownership check there is.
 *
 * There are no actions for a photo, an objective or a stored level: the schema
 * has nowhere to put them. See supabase/not-applied/README-additive.md.
 *
 * Test: tests/app/(student)/profile/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import { assertAuth } from '../../../lib/auth/assertAuth';
import * as profileService from '../../../lib/services/profile.service';
import {
    categoryLevelSchema,
    interestsSchema,
    nameSchema,
} from '../../../lib/validation/profile.schema';
import { fieldErrors, formError, formSuccess, type FormState } from '../../../lib/validation/common';
import type { Result } from '../../../lib/result';
import type { AppError } from '../../../lib/errors';

/** Every action ends the same way, so the ending is written once. */
function settle(result: Result<unknown, AppError>, successMessage: string): FormState {
    if (!result.ok) {
        return formError(result.error.message, result.error.fields);
    }

    revalidatePath('/profile');
    // The header shows the name and the XP level, so the layout re-renders too
    // — otherwise a rename appears in the section but not at the top.
    revalidatePath('/', 'layout');

    return formSuccess(successMessage);
}

export async function updateNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const user = await assertAuth();

    const parsed = nameSchema.safeParse({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName') ?? '',
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    return settle(
        await profileService.updateName(user.userId, parsed.data.firstName, parsed.data.lastName),
        'Name updated.',
    );
}

export async function updateInterestsAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const user = await assertAuth();

    const parsed = interestsSchema.safeParse({ categoryIds: formData.getAll('categoryIds') });

    if (!parsed.success) return formError('Check your selection.', fieldErrors(parsed.error));

    return settle(
        await profileService.setInterests(user.userId, parsed.data.categoryIds),
        'Interests updated.',
    );
}

/**
 * Self-declaring a level for one category. This writes
 * category_progress.current_level — the same column an assessment result
 * writes, so the newer of the two always wins.
 */
export async function setCategoryLevelAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const user = await assertAuth();

    const parsed = categoryLevelSchema.safeParse({
        categoryId: formData.get('categoryId'),
        level: formData.get('level'),
    });

    if (!parsed.success) return formError('Pick one of the three levels.');

    return settle(
        await profileService.setCategoryLevel(user.userId, parsed.data.categoryId, parsed.data.level),
        'Level updated.',
    );
}
