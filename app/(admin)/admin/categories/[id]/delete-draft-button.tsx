/**
 * Reject an AI draft — the delete half of SP-092 AC3.
 *
 * Shaped like StatusToggle rather than sharing it: that component posts a
 * `status`, and this one posts nothing but an id. The two look alike on screen
 * and have nothing in common in the form they submit, which is why generalising
 * StatusToggle to cover both would mean a prop that switches its whole payload.
 *
 * The page only renders this for an inactive AI draft, and the service refuses
 * anything else regardless — so the worst a forged questionId achieves is the
 * sentence explaining that. A visible-page check is a convenience, never the
 * boundary (§5).
 *
 * A DELETE, WITH NO CONFIRM DIALOG, AND THAT IS A CHOICE. What it removes is a
 * generated draft nobody has been shown; the cost of a mis-click is one press
 * of Generate. The controls that touch a question members HAVE answered are
 * deactivations, which are reversible, and they are the ones this screen makes
 * hard to get wrong.
 */

'use client';

import { useActionState } from 'react';
import { deleteQuestionAction } from './actions';
import { SubmitButton } from '../../../../../components/submit-button';
import { FormStatus } from '../../../../../components/form-status';
import { IDLE } from '../../../../../lib/validation/common';

interface DeleteDraftButtonProps {
    questionId: number;
    categoryId: number;
    /** Spoken label, since "Delete" alone does not say what. */
    questionText: string;
}

export function DeleteDraftButton({
    questionId,
    categoryId,
    questionText,
}: DeleteDraftButtonProps) {
    const [state, formAction] = useActionState(deleteQuestionAction, IDLE);

    return (
        <form action={formAction} className="flex flex-col items-center gap-1.5">
            <input type="hidden" name="questionId" value={questionId} />
            <input type="hidden" name="categoryId" value={categoryId} />

            <SubmitButton
                size="sm"
                variant="ghost"
                pendingLabel="Deleting…"
                aria-label={`Delete draft ${questionText}`}
            >
                Delete
            </SubmitButton>

            {/* The row disappears on success, so only a refusal needs room. */}
            <FormStatus
                state={state}
                className={state.status === 'error' ? 'max-w-56 text-center' : 'sr-only'}
            />
        </form>
    );
}

export default DeleteDraftButton;
