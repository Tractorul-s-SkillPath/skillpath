/**
 * Admin route-group layout.
 *
 * Layer: PAGE
 * Story: SP-012
 *
 * assertAdmin() here is the guard for the whole group — a student who types
 * /admin/users lands on /dashboard instead. This used to be a bare div with a
 * className that matched no CSS anywhere, which meant the group was reachable
 * by anybody holding a session; the pages under it happened to crash rather
 * than render, which is not a security control.
 *
 * Middleware only checks that a cookie exists. It cannot check a role: role
 * comes from the database and the Edge runtime has no client for that.
 *
 * The nav is the five admin surfaces. Most of them are placeholders for now.
 */

import * as React from 'react';
import Link from 'next/link';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import { logoutAction } from '../../../lib/auth/current-user';
import { Button } from '../../../components/ui/button';
import { fullName } from '../../../lib/utils';

const NAV = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/questions', label: 'Questions' },
    { href: '/admin/results', label: 'Results' },
    { href: '/admin/users', label: 'Users' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const admin = await assertAdmin();

    return (
        <div className="min-h-dvh bg-background">
            <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
                    <Link href="/admin" className="text-sm font-semibold tracking-tight">
                        SkillPath <span className="text-muted-foreground">admin</span>
                    </Link>

                    <nav
                        className="hidden flex-1 items-center gap-1 md:flex"
                        aria-label="Admin sections"
                    >
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="rounded-md px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-3">
                        <span className="hidden text-[0.8125rem] text-muted-foreground sm:inline">
                            {fullName(admin.user.first_name, admin.user.last_name)}
                        </span>

                        <form action={logoutAction}>
                            <Button type="submit" size="sm" variant="ghost">
                                Sign out
                            </Button>
                        </form>
                    </div>
                </div>
            </header>

            <main>{children}</main>
        </div>
    );
}
