import { changePasswordAction } from '../../../lib/auth/current-user';
import { Field, Input } from '../../../components/ui/field';
import { SubmitButton } from '../../../components/submit-button';
import Link from 'next/link';

export const metadata = { title: 'Change password' };

const ERRORS: Record<string, string> = {
    missing_fields: 'Please fill in all password fields.',
    password_too_short: 'New password must be at least 8 characters long.',
    passwords_dont_match: 'The new passwords do not match.',
    invalid_current: 'Current password is incorrect.',
    unavailable: 'Could not update password. Please try again later.'
};

interface PageProps {
    searchParams?: Promise<{ error?: string; success?: string }>;
}

export default async function ChangePasswordPage({ searchParams }: PageProps) {
    const params = (await searchParams) ?? {};
    const error = params.error ? (ERRORS[params.error] ?? ERRORS.unavailable) : null;
    const success = params.success === 'true';

    return (
        <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6 mt-10">
            <h1 className="text-base font-semibold tracking-tight">Change password</h1>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Update your password to keep your account secure.
            </p>

            {error ? (
                <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">
                    {error}
                </p>
            ) : null}

            {success ? (
                <p className="mt-4 rounded-lg bg-green-500/10 border border-green-500/25 px-3 py-2 text-[0.8125rem] text-green-600">
                    Password updated successfully!
                </p>
            ) : null}

            <form action={changePasswordAction} className="mt-5 space-y-4">
                <Field label="Current password" htmlFor="currentPassword">
                    <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        placeholder="Enter your password"
                    />
                </Field>

                <Field label="New password" htmlFor="newPassword">
                    <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        minLength={8}
                        required
                    />
                </Field>

                <Field label="Confirm new password" htmlFor="confirmPassword">
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter new password"
                        minLength={8}
                        required
                    />
                </Field>

                <SubmitButton variant="primary" pendingLabel="Updating…" className="w-full justify-center">
                    Update password
                </SubmitButton>
            </form>

            <div className="mt-5 text-center">
                <Link href="/dashboard" className="text-[0.8125rem] font-medium text-[color:var(--accent)] hover:underline">
                    Back to dashboard
                </Link>
            </div>
        </div>
    );
}