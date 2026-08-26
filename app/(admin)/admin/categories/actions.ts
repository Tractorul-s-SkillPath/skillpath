/**
 * Category actions.
 *
 * Layer: ACTION — assertAdmin (in the service) -> zod.parse -> service ->
 * revalidatePath (§3)
 * Stories: SP-031, SP-032
 *
 * A unique name violation comes back from the repository as a `conflict` with a
 * field message on `name`, and is rendered next to the input. A 500 on a
 * duplicate name is a bug (SP-031 AC2).
 *
 * deactivateCategory is a status change, never a delete: hiding a category from
 * the student picker must not touch the assessments that point at it (SP-032).
 *
 * These return FormState, and read the services as Results rather than wrapping
 * them in try/catch. A service in this codebase does not throw on failure — it
 * returns `{ ok: false }` — so a try/catch around one catches nothing and the
 * success path runs on a failed write. That is how "Category created
 * successfully!" came back from a create that never happened.
 *
 * Test: tests/app/(admin)/admin/categories/actions.test.ts
 */

'use server';

import { revalidatePath } from 'next/cache';
import * as categoryService from '../../../../lib/services/category.service';
import { categorySchema, categoryStatusSchema } from '../../../../lib/validation/category.schema';
import {
    fieldErrors,
    formError,
    formSuccess,
    type FormState,
} from '../../../../lib/validation/common';

export async function createCategoryAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = categorySchema.safeParse({
        name: formData.get('name') ?? '',
        description: formData.get('description'),
    });

    if (!parsed.success) return formError('Check the fields below.', fieldErrors(parsed.error));

    const result = await categoryService.createCategory(parsed.data);

    if (!result.ok) {
        // A conflict on the name arrives with the explanation already attached
        // to the field. Repeating it as the summary line printed it twice, once
        // under the input and once beside the button.
        return result.error.fields
            ? formError('Check the fields below.', result.error.fields)
            : formError(result.error.message);
    }

    revalidatePath('/admin/categories');

    return formSuccess(`"${result.value.name}" created.`);
}

/**
 * Activate or deactivate.
 *
 * The previous version caught every error, logged it and returned nothing, so a
 * failed update was indistinguishable from a successful one: the page
 * re-rendered with the old status and said nothing at all. A failure that the
 * person who caused it cannot see is worse than an error message.
 */
export async function setCategoryStatusAction(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = categoryStatusSchema.safeParse({
        categoryId: formData.get('categoryId'),
        status: formData.get('status'),
    });

    if (!parsed.success) return formError('That change could not be applied.');

    const result = await categoryService.setCategoryStatus(
        parsed.data.categoryId,
        parsed.data.status,
    );

    if (!result.ok) return formError(result.error.message, result.error.fields);

    revalidatePath('/admin/categories');

    return formSuccess(
        parsed.data.status === 'active'
            ? 'Category activated.'
            : 'Category deactivated — existing assessments are untouched.',
    );
}
