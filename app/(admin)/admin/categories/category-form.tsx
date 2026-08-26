/**
 * Create a category.
 *
 * Story: SP-031
 *
 * The uniqueness error comes back from the action as a FIELD error on `name`
 * and is rendered under the input (SP-031 AC2) — the repository maps Postgres
 * 23505 into it, so the admin reads "a category with that name already exists"
 * rather than a 500.
 *
 * useActionState, from `react`. This was useFormState from `react-dom`, which
 * React 19 renamed; the old name is deprecated and its typings no longer line
 * up with a two-argument action, which is what broke the build.
 */

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createCategoryAction } from './actions';
import { IDLE } from '../../../../lib/validation/common';
import { Field, Input } from '../../../../components/ui/field';
import { SubmitButton } from '../../../../components/submit-button';
import { FormStatus } from '../../../../components/form-status';
import { CATEGORY_NAME_MAX } from '../../../../lib/validation/category.schema';

export function CategoryForm() {
    const [state, formAction] = useActionState(createCategoryAction, IDLE);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.status === 'success') formRef.current?.reset();
    }, [state.status]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4">
            <Field
                label="Name"
                htmlFor="category-name"
                error={state.fields?.name}
                hint={`2–${CATEGORY_NAME_MAX} characters`}
            >
                <Input
                    id="category-name"
                    name="name"
                    required
                    maxLength={CATEGORY_NAME_MAX}
                    placeholder="e.g. TypeScript"
                />
            </Field>

            <Field label="Description" htmlFor="category-description" error={state.fields?.description}>
                <textarea
                    id="category-description"
                    name="description"
                    rows={3}
                    maxLength={500}
                    placeholder="What this category covers."
                    className="w-full resize-none rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle-foreground"
                />
            </Field>

            <div className="flex items-center justify-between gap-3">
                <FormStatus state={state} />
                <SubmitButton variant="primary" pendingLabel="Saving…">
                    Add category
                </SubmitButton>
            </div>
        </form>
    );
}

export default CategoryForm;
