'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPasswordAction } from '../../lib/auth/current-user';
import { Field, Input } from '../../components/ui/field';
import { SubmitButton } from '../../components/submit-button';
import { buttonClass } from '../../components/ui/button';

const ERRORS: Record<string, string> = {
    missing_email: 'Email address is missing. Please restart the process.',
    missing_fields: 'Please fill in all fields.',
    password_too_short: 'Password must be at least 8 characters long.',
    passwords_dont_match: 'Passwords do not match.',
    unavailable: 'We could not reach the account service. Try again in a moment.'
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
                    <h1 className="text-lg font-semibold tracking-tight text-danger">Invalid Request</h1>
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
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h1 className="text-xl font-semibold tracking-tight">Password reset successfully!</h1>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Your password has been changed securely. Click OK to continue.
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
                        <h1 className="text-lg font-semibold tracking-tight text-center">Set new password</h1>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-center">
                            Please choose a new password for <span className="font-medium text-foreground">{email}</span>.
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
                            <Field label="New password" htmlFor="newPassword">
                                <Input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    required
                                />
                            </Field>

                            <Field label="Confirm password" htmlFor="confirmPassword">
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Re-enter password"
                                    required
                                />
                            </Field>

                            <SubmitButton
                                variant="primary"
                                pendingLabel="Updating password…"
                                className="w-full justify-center py-3"
                                disabled={isPending}
                            >
                                Update password
                            </SubmitButton>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}