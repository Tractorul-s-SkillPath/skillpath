import Link from 'next/link';

export const metadata = { title: 'Account Created Successfully' };

export default function SuccessPage() {
    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-6 py-10 sm:px-8 text-center space-y-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Account created successfully!
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
                Your account has been created. You can now sign in with your credentials.
            </p>
            <div className="pt-2">
                <Link
                    href="/login"
                    className="inline-flex w-full justify-center rounded-lg bg-[color:var(--accent)] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)]"
                >
                    Sign in to your account
                </Link>
            </div>
        </div>
    );
}