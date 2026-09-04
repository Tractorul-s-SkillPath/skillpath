'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Field, Input } from '../../components/ui/field';
import { SubmitButton } from '../../components/submit-button';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail) {
            setError('Please enter your email address.');
            return;
        }

        setError(null);

        window.open(`/reset-password?email=${encodeURIComponent(trimmedEmail)}`, '_blank');
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background text-foreground">
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6 shadow-sm">
                <h1 className="text-base font-semibold tracking-tight">Forgot password?</h1>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                    Enter your email address to proceed with the password reset.
                </p>

                {error ? (
                    <p
                        role="alert"
                        className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] leading-relaxed text-danger"
                    >
                        {error}
                    </p>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <Field label="Email" htmlFor="email">
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </Field>

                    <SubmitButton
                        variant="primary"
                        pendingLabel="Opening reset page…"
                        className="w-full justify-center"
                    >
                        Reset password
                    </SubmitButton>
                </form>

                <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
                    Remembered your password?{' '}
                    <Link
                        href="/login"
                        className="font-medium text-[color:var(--accent)] hover:underline"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
