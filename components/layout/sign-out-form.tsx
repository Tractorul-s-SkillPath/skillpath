/**
 * Sign out, as a menu item that asks first.
 *
 * TWO THINGS THIS OWES THE USER
 *
 * 1. It looks destructive on hover. Sign out sits directly under "Your
 *    profile" in a list of otherwise harmless links, at the bottom of a menu
 *    where a stray click is cheap to make. Turning red under the pointer is
 *    the cheapest possible warning and costs nothing when it is what you meant.
 *
 * 2. It confirms. The click is one pixel from the theme buttons, and the cost
 *    of getting it wrong is a full sign-in round trip.
 *
 * The trigger is a plain button; the real submit lives inside the dialog, so
 * the server action still runs from a <form> and still gets a pending state.
 *
 * WITHOUT JAVASCRIPT this renders a trigger that opens nothing — so /logout
 * stays as it is. That page is the same question as a full navigation, and it
 * is what the "Sign out" link in a no-JS context should point at.
 */

'use client';

import { ConfirmDialog } from '../confirm-dialog';
import { SubmitButton } from '../submit-button';

export function SignOutForm({ action }: { action: () => Promise<void> }) {
    return (
        <ConfirmDialog
            triggerLabel="Sign out"
            // A menu row, not a button: full width, text left, tighter padding.
            // The hover pair is merged over the ghost variant's own — twMerge
            // keeps the caller's, so these replace rather than fight them.
            triggerClassName="w-full justify-start px-2.5 hover:bg-danger-soft hover:text-[color:var(--danger)]"
            title="Sign out of SkillPath?"
            description="Your progress stays exactly where it is. You will need to sign in again to get back."
            confirm={
                <form action={action}>
                    <SubmitButton size="sm" variant="danger" pendingLabel="Signing out…">
                        Sign out
                    </SubmitButton>
                </form>
            }
            cancelLabel="Stay signed in"
        />
    );
}

export default SignOutForm;
