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
 * The nav is the four admin surfaces. Questions used to be a fifth: the bank
 * screen and the AI generator were both scaffolded and never written, and
 * questions are authored inside a category, on /admin/categories/[id], where
 * the one thing they cannot exist without is already on screen. A nav entry
 * leading to a placeholder is a promise the app does not keep.
 */

import * as React from 'react';
import Link from 'next/link';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import { logoutAction } from '../../../lib/auth/current-user';
import { MobileNav } from '../../../components/layout/mobile-nav';
import { NavLinks } from '../../../components/layout/nav-links';
import { UserNav } from '../../../components/layout/user-nav';
import { SignOutForm } from '../../../components/layout/sign-out-form';
import { fullName, initialsOf } from '../../../lib/utils';

const NAV = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/results', label: 'Results' },
    { href: '/admin/users', label: 'Users' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const admin = await assertAdmin();

    const name = fullName(admin.user.first_name, admin.user.last_name);

    return (
        <div className="min-h-dvh bg-background">
            <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
                    {/* Four sections, all of them unreachable below md until
                        this existed. */}
                    <MobileNav items={NAV} className="md:hidden">
                        <SignOutForm action={logoutAction} />
                    </MobileNav>

                    <Link href="/admin" className="text-sm font-semibold tracking-tight">
                        SkillPath <span className="text-muted-foreground">admin</span>
                    </Link>

                    <NavLinks
                        items={NAV}
                        label="Admin sections"
                        className="hidden flex-1 md:flex"
                    />

                    <div className="ml-auto flex items-center gap-2 sm:gap-3">
                        <span className="hidden text-[0.8125rem] text-muted-foreground md:inline">
                            {name}
                        </span>

                        {/* No `level`: XP is a student concept and an admin
                            standing of "Level 1" would be a made-up number. */}
                        <UserNav
                            name={name}
                            email={admin.user.email}
                            initials={initialsOf(
                                admin.user.first_name,
                                admin.user.last_name,
                                admin.user.email,
                            )}
                            seed={String(admin.user.user_id)}
                            accountHref="/admin/account"
                            accountLabel="Your account"
                            signOut={<SignOutForm action={logoutAction} />}
                        />
                    </div>
                </div>
            </header>

            <main id="main">{children}</main>
        </div>
    );
}
