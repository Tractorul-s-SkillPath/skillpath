/**
 * Login page.
 *
 * Layer: PAGE — renders the form, no logic
 * Story: SP-010
 *
 * WHAT CHANGED IN THE UX PASS
 *
 *  - JSX and the design system, instead of React.createElement with inline hex
 *    colours. This was the first screen anybody saw and it looked like a
 *    different product from the one behind it.
 *  - English. The error read "Email sau parolă incorectă" while every other
 *    string in the app was in English.
 *  - Labels are tied to their inputs with htmlFor/id. They were sibling
 *    elements with no association, so clicking a label did nothing and a screen
 *    reader announced unlabelled fields.
 *  - `?next=` is carried through as a hidden field. Middleware has always
 *    appended it when it bounces someone off a protected page; nothing read it,
 *    so you were sent to your role's home instead of where you were going.
 *  - The role dropdown is gone from THIS form. It is on /register instead.
 *    ► This is the one behaviour change in the UX pass. It only ever did
 *      anything when the email had never been seen before, because an existing
 *      account takes its role from the database — so on a login form it was a
 *      control that silently did nothing for every real sign-in, while asking
 *      members a question ("are you an admin?") that a login form should not
 *      ask. Creating an admin still works, from /register. Revert by putting
 *      the same <select name="role"> back here; loginAction still reads it.
 *
 * The password field stays, and stays unverified — that is a recorded team
 * decision, documented at length in lib/auth/current-user.ts.
 */

import Link from 'next/link';
import { loginAction } from './actions';
import { Field, Input } from '../../../components/ui/field';
import { SubmitButton } from '../../../components/submit-button';

export const metadata = { title: 'Sign in' };

/** Every reason loginAction can bounce back here, in English, once. */
const ERRORS: Record<string, string> = {
    invalid: 'Enter the email address you signed up with.',
    unavailable: 'We could not reach the account service. Try again in a moment.',
    disabled: 'That account has been deactivated. Ask an administrator to re-enable it.',
};

interface LoginPageProps {
    searchParams?: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = (await searchParams) ?? {};
    const error = params.error ? (ERRORS[params.error] ?? ERRORS.unavailable) : null;

    // Only ever a path on this site. An absolute URL here would make the login
    // form an open redirect.
    const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : null;

    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6">
            <h1 className="text-base font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Pick up where you left off.
            </p>

            {error ? (
                <p
                    role="alert"
                    className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] leading-relaxed text-danger"
                >
                    {error}
                </p>
            ) : null}

            <form action={loginAction} className="mt-5 space-y-4">
                {next ? <input type="hidden" name="next" value={next} /> : null}

                <Field label="Email" htmlFor="email">
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                    />
                </Field>

                <Field label="Password" htmlFor="password">
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Your password"
                        required
                    />
                </Field>

                {/* The round trip hits the database and then redirects. A plain
                    Button gave a second of no feedback on the most-used form in
                    the app, and nothing stopped a second click. */}
                <SubmitButton
                    variant="primary"
                    pendingLabel="Signing in…"
                    className="w-full justify-center"
                >
                    Sign in
                </SubmitButton>
            </form>

            <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
                No account yet?{' '}
                <Link href="/register" className="font-medium text-[color:var(--accent)] hover:underline">
                    Create one
                </Link>
            </p>
        </div>
    );
}
