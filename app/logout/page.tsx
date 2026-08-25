/**
 * Sign out confirmation.
 *
 * Layer: PAGE
 * Story: SP-010
 *
 * TWO THINGS WERE WRONG HERE AND BOTH ARE FIXED BY THE MOVE
 *
 * 1. This page lived in `app/(auth)/logout/actions.ts` — a default-exporting
 *    React component, in a file named `actions.ts`, with no 'use server'. A
 *    file called `actions.ts` is not a route in the App Router, so `/logout`
 *    did not exist: it 404'd. The component was unreachable.
 *
 * 2. It cannot go back into the `(auth)` group either. That layout redirects
 *    anybody holding a session to their role's home, so a signed-in member —
 *    the only kind that can sign out — would be bounced to /dashboard before
 *    ever seeing the button. Hence `app/logout/`, outside the group.
 *
 * The headers all sign out inline, so this page is the fallback for somebody
 * who types the URL or follows an old bookmark.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from './actions';
import { getCurrentUser } from '../../lib/auth/current-user';
import { buttonClass } from '../../components/ui/button';
import { SubmitButton } from '../../components/submit-button';

export const metadata = { title: 'Sign out' };

export const dynamic = 'force-dynamic';

export default async function LogoutPage() {
    // Nothing to sign out of. Sending them to /login is kinder than a
    // confirmation dialog for an action that would do nothing.
    if (!(await getCurrentUser())) {
        redirect('/login');
    }

    return (
        <main
            id="main"
            className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 sm:px-6"
        >
            <div className="w-full rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 text-center sm:px-6">
                <h1 className="text-base font-semibold tracking-tight">Sign out of SkillPath?</h1>

                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    Your progress stays exactly where it is.
                </p>

                <form action={logoutAction} className="mt-5 space-y-2">
                    <SubmitButton
                        variant="primary"
                        pendingLabel="Signing out…"
                        className="w-full justify-center"
                    >
                        Sign out
                    </SubmitButton>
                </form>

                <Link
                    href="/dashboard"
                    className={buttonClass('ghost', 'sm', 'mt-2 w-full justify-center')}
                >
                    Stay signed in
                </Link>
            </div>
        </main>
    );
}
