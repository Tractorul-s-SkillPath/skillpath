/**
 * StatusToggle — one row's activate / deactivate switch.
 *
 * Stories: SP-032, SP-083
 *
 * Both the user table and the category table need the same thing: a one-button
 * form that posts a target status and can report back that it was refused. The
 * refusals are real — an admin may not deactivate themselves (SP-014) — and the
 * first version of both screens threw that answer away, so the click looked
 * like it had worked and the row simply did not change.
 *
 * The button posts the status it WANTS rather than the one it can see. See the
 * note in users/actions.ts: flipping a stale value server-side gives a
 * different result depending on how old the page is.
 */

'use client';

import { useActionState } from 'react';
import { SubmitButton } from '../../../components/submit-button';
import { FormStatus } from '../../../components/form-status';
import { IDLE, type FormState } from '../../../lib/validation/common';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

interface StatusToggleProps {
    action: Action;
    /** Hidden inputs identifying the row — `userId`, or `categoryId`. */
    fields: Record<string, string | number>;
    /** The status this button switches to. */
    target: 'active' | 'inactive';
    label: string;
    /** Spoken label, since "Deactivate" alone does not say what. */
    describedAs: string;
}

export function StatusToggle({ action, fields, target, label, describedAs }: StatusToggleProps) {
    const [state, formAction] = useActionState(action, IDLE);

    return (
        <form action={formAction} className="flex flex-col items-center gap-1.5">
            {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="status" value={target} />

            <SubmitButton
                size="sm"
                variant={target === 'inactive' ? 'danger' : 'secondary'}
                pendingLabel="Saving…"
                aria-label={`${label} ${describedAs}`}
            >
                {label}
            </SubmitButton>

            {/*
              A success needs no visible text — the row itself changes — but it
              still has to be announced, so FormStatus keeps its live region and
              only the error case takes up space.
            */}
            <FormStatus
                state={state}
                className={
                    state.status === 'error'
                        ? 'max-w-56 text-center'
                        : 'sr-only'
                }
            />
        </form>
    );
}

export default StatusToggle;
