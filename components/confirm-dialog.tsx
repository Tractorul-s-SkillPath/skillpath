/**
 * Confirmation dialog.
 *
 * Stories: SP-032, SP-046, SP-047
 *
 * Was a docblock with no component under it. Written now because sign out
 * needed it, and written generically because the three stories above want the
 * same thing: submitting with unanswered questions, abandoning a run, and
 * deactivating a category.
 *
 * NATIVE <dialog>, NOT A DIV
 *
 * `showModal()` gives the focus trap, the Escape handling, the inert
 * background and `aria-modal` for free, and puts the element in the top layer —
 * which is what lets this work from inside the user menu, a small absolutely
 * positioned box that would otherwise clip it.
 *
 * The action itself is a slot rather than a prop. Sign out posts a server
 * action with no arguments; abandoning a run will want useActionState and
 * hidden fields. Rather than grow a union of every shape a caller might need,
 * the caller passes its own <form> and this owns only the asking.
 *
 * A slot that NAVIGATES rather than submits — starting an assessment is a link
 * into a new tab — leaves this dialog open behind it, because nothing
 * unmounts. So the slot may instead be a function receiving `close`. Only a
 * client component can pass that (a function prop is not serialisable), which
 * is why start-dialog.tsx exists between the assessments page and this.
 */

'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './ui/button';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
    /** Contents of the button that opens the dialog. */
    triggerLabel: React.ReactNode;
    /** Merged over the trigger's own styling — twMerge lets it win. */
    triggerClassName?: string;
    triggerAriaLabel?: string;
    triggerVariant?: ButtonProps['variant'];
    triggerSize?: ButtonProps['size'];
    title: string;
    description?: string;
    /**
     * The control that actually does the thing — normally a <form> wrapping a
     * SubmitButton. Rendered beside Cancel. Pass a function to receive the
     * closer, for a control that navigates instead of unmounting the dialog.
     */
    confirm: React.ReactNode | ((close: () => void) => React.ReactNode);
    cancelLabel?: string;
}

export function ConfirmDialog({
    triggerLabel,
    triggerClassName,
    triggerAriaLabel,
    triggerVariant = 'ghost',
    triggerSize = 'sm',
    title,
    description,
    confirm,
    cancelLabel = 'Cancel',
}: ConfirmDialogProps) {
    const ref = React.useRef<HTMLDialogElement>(null);
    const [open, setOpen] = React.useState(false);
    const titleId = React.useId();
    const descriptionId = React.useId();

    // showModal() is imperative, so React state drives it rather than the other
    // way round. Guarded both ways: calling showModal() on an already-open
    // dialog throws.
    React.useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;

        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <>
            <Button
                type="button"
                size={triggerSize}
                variant={triggerVariant}
                aria-label={triggerAriaLabel}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                className={triggerClassName}
            >
                {triggerLabel}
            </Button>

            <dialog
                ref={ref}
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                // Escape and the close() above both land here, so state cannot
                // drift out of sync with what the browser actually did.
                onClose={() => setOpen(false)}
                // A click that lands on the dialog element itself is a click on
                // the backdrop — the padding box is covered by the inner div.
                onClick={(event) => {
                    if (event.target === ref.current) setOpen(false);
                }}
                className={cn(
                    'm-auto w-[calc(100vw-2rem)] max-w-sm rounded-[var(--radius-card)] p-0',
                    'border border-border bg-surface text-foreground shadow-xl',
                    // The open-state animation is in globals.css, on
                    // `dialog[open]`: `rise` is hand-written CSS rather than a
                    // generated utility, so Tailwind variants cannot compose
                    // with it and `open:rise` would emit nothing.
                    'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
                )}
            >
                <div className="px-5 py-5 sm:px-6">
                    <h2 id={titleId} className="text-base font-semibold tracking-tight">
                        {title}
                    </h2>

                    {description ? (
                        <p
                            id={descriptionId}
                            className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground"
                        >
                            {description}
                        </p>
                    ) : null}

                    {/* Cancel first in the DOM so it takes initial focus: the
                        safe choice should be the one you get by pressing Enter
                        without reading. */}
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                            {cancelLabel}
                        </Button>
                        {typeof confirm === 'function' ? confirm(() => setOpen(false)) : confirm}
                    </div>
                </div>
            </dialog>
        </>
    );
}

export default ConfirmDialog;
