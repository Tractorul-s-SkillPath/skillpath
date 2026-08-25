/**
 * Close-on-outside-click and close-on-Escape, for any popover-ish thing.
 *
 * Both the mobile nav panel and the user menu need exactly this and nothing
 * more, and two copies of it would drift apart the first time one of them got
 * a bug fix.
 *
 * `pointerdown` rather than `click`: a click fires after the pointer is
 * released, so a menu closing on `click` stays open for the whole duration of a
 * press-and-drag and feels stuck. `keydown` for Escape has to be on the
 * document, not the panel — the panel may not hold focus.
 */

'use client';

import * as React from 'react';

export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
    const ref = React.useRef<T>(null);

    React.useEffect(() => {
        if (!open) return;

        /**
         * A modal dialog opened from inside the panel is ABOVE it, not outside
         * it. Without this, clicking "Cancel" in the sign-out confirmation
         * counted as an outside click: the menu closed, taking the dialog it
         * owned down with it, and the confirmation vanished mid-question.
         *
         * `dialog[open]` rather than a ref, because the dialog is in the top
         * layer and is not a DOM descendant of anything this hook knows about.
         */
        function inTopLayer(target: EventTarget | null): boolean {
            return target instanceof Element && Boolean(target.closest('dialog[open]'));
        }

        function onPointerDown(event: PointerEvent) {
            if (inTopLayer(event.target)) return;

            // A click on the trigger is the trigger's business — it toggles.
            // Closing here as well would make the two cancel out.
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key !== 'Escape') return;

            // The dialog is the innermost thing open, so Escape belongs to it.
            // The browser closes it natively; the menu must not also close, or
            // one Escape would dismiss two layers at once.
            if (document.querySelector('dialog[open]')) return;

            onClose();
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    /** Put this on the element that wraps BOTH the trigger and the panel. */
    return ref;
}
