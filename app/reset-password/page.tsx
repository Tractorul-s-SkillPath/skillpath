'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPasswordAction } from '../../lib/auth/current-user';
import { SubmitButton } from '../../components/submit-button';
import { buttonClass } from '../../components/ui/button';

const ERRORS: Record<string, string> = {
    missing_email: 'Email address is missing. Please restart the process.',
    unavailable: 'We could not reach the account service. Try again in a moment.',
};

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email');

    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);

    if (!email) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-background text-foreground">
                <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface px-8 py-12 text-center shadow-sm flex flex-col justify-center">
                    <h1 className="text-lg font-semibold tracking-tight text-danger">
                        Invalid Request
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground mb-4">
                        No email session was provided for resetting the password.
                    </p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsPending(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        formData.append('email', email);

        const result = await resetPasswordAction(formData);

        setIsPending(false);

        if (result?.error) {
            setError(ERRORS[result.error] ?? ERRORS.unavailable);
        } else if (result?.success) {
            setIsSuccess(true);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background text-foreground">
            <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface px-8 py-12 shadow-sm flex flex-col items-center text-center">
                {isSuccess ? (
                    <div className="flex flex-col items-center w-full">
                        <div className="rounded-full bg-green-500/10 p-4 text-green-600 mb-4 border border-green-500/20">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-10 w-10"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>

                        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            If <span className="font-medium text-foreground">{email}</span> has an
                            account, a reset link is on its way. Open it to choose a new password.
                        </p>

                        <div className="mt-6 w-full">
                            <button
                                onClick={() => {
                                    if (window.opener) {
                                        window.opener.location.href = '/login';
                                    }
                                    window.close();
                                }}
                                className={buttonClass('primary') + ' w-full justify-center'}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full text-left">
                        {/*
                         * THE NEW PASSWORD IS NOT CHOSEN HERE ANY MORE, AND THAT IS A FIX.
                         *
                         * This form used to collect an address and a new password and post
                         * both to an unauthenticated action that ran, in effect,
                         *
                         *     update users set password = <hash> where email = <posted>
                         *
                         * with no token and no proof of ownership. Anyone who knew an
                         * address could take the account — and admin@skillpath.dev is in
                         * the seed. Supabase Auth sends a signed, expiring link instead,
                         * and the password is chosen on the page that link opens, so
                         * possession of the mailbox is what authorises the change.
                         */}
                        <h1 className="text-lg font-semibold tracking-tight text-center">
                            Reset your password
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-center">
                            We&rsquo;ll email a reset link to{' '}
                            <span className="font-medium text-foreground">{email}</span>. The link
                            opens a page where you can choose a new password.
                        </p>

                        {error ? (
                            <p
                                role="alert"
                                className="mt-4 rounded-lg bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger text-center"
                            >
                                {error}
                            </p>
                        ) : null}

                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            <SubmitButton
                                variant="primary"
                                pendingLabel="Sending link…"
                                className="w-full justify-center py-3"
                                disabled={isPending}
                            >
                                Send reset link
                            </SubmitButton>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
