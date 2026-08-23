/**
 * FormStatus — what a Server Action just did, said out loud.
 *
 * Every profile action returns a FormState carrying a message: "Name updated.",
 * "Interests updated.", "Done — XP updated.". Nothing rendered them. Both the
 * profile header and the interests section used `state.status === 'success'`
 * only to close their editor, so a save looked identical to nothing happening.
 *
 * `aria-live="polite"` is the other half. There was no live region anywhere in
 * the app, which meant a screen-reader user got no confirmation that a save
 * had worked and no announcement when one failed — the message simply appeared
 * in the page and was never read.
 *
 * `role="alert"` is deliberately not used for the success case: alert is
 * assertive and interrupts, which is right for an error and rude for "Saved."
 */

import { cn } from '../lib/utils';
import type { FormState } from '../lib/validation/common';

interface FormStatusProps {
    state: FormState;
    className?: string;
}

export function FormStatus({ state, className }: FormStatusProps) {
    const message = state.status === 'idle' ? null : state.message;

    return (
        <p
            aria-live="polite"
            className={cn(
                'text-[0.8125rem] leading-relaxed transition-colors',
                state.status === 'error' ? 'text-danger' : 'text-[color:var(--success)]',
                message ? '' : 'sr-only',
                className,
            )}
        >
            {message}
        </p>
    );
}
