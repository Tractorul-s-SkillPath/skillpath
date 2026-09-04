/**
 * Registration page.
 *
 * Layer: PAGE
 * Story: SP-011
 *
 * Posts to registerAction, which is loginAction underneath: that action creates
 * the account when the email has never been seen, which is exactly what
 * registering is here. See ./actions.ts for what it does and does not check —
 * in particular, the password field below is collected and never verified.
 *
 * The category checkboxes come from `skill_categories` rather than a hardcoded
 * list, so a category an admin adds shows up here without an edit.
 *
 * Rewritten from React.createElement into JSX in the UX pass, along with the
 * rest of the auth group. The role selector lives here now rather than on the
 * login form — see the header of ../login/page.tsx for why.
 */

import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import { listActiveCategories } from '../../../lib/repositories/profile.repo';
import { unwrapOr } from '../../../lib/result';
import RegisterForm from './register-form';

export const metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ error?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const error = params?.error;

    const supabase = await createClient();
    const categories = unwrapOr(await listActiveCategories(supabase), []);

    return (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface px-5 py-6 sm:px-6">
            <h1 className="text-base font-semibold tracking-tight">Create an account</h1>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Takes a minute. You can change all of this later.
            </p>

            {error === 'name_already_exists' && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
                    A user with this name is already registered. Please use a different name.
                </div>
            )}

            {error === 'email_already_exists' && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
                    An account with this email already exists. Please use a different email.
                </div>
            )}

            {error === 'manager_approval_required' && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
                    Manager approval is required for the administrator role.
                </div>
            )}

            <RegisterForm categories={categories} />

            <p className="mt-5 text-center text-[0.8125rem] text-muted-foreground">
                Already have an account?{' '}
                <Link
                    href="/login"
                    className="font-medium text-[color:var(--accent)] hover:underline"
                >
                    Sign in
                </Link>
            </p>
        </div>
    );
}
