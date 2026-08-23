/**
 * Auth route-group layout.
 *
 * Layer: PAGE
 * Stories: SP-010, SP-011
 *
 * A centred card shell, no app nav.
 *
 * The redirect here is the one this layout's docblock always claimed and never
 * did. Middleware bounces a cookie-holder off /login and /register, but
 * middleware cannot read a role — so it sent everyone to /dashboard, including
 * admins, who landed on a student page. This checks properly and sends each
 * role to its own home.
 *
 * The className used to be `auth-container`, which matched no CSS anywhere in
 * the project. Every auth page therefore carried its own inline styles.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: ReactNode }) {
    const user = await getCurrentUser();

    if (user) {
        redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    }

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <header className="px-4 py-5 sm:px-6">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                    SkillPath
                </Link>
            </header>

            <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:px-6">
                <div className="w-full max-w-sm">{children}</div>
            </main>
        </div>
    );
}
