/**
 * Site header.
 *
 * Story: SP-012
 *
 * Shows who is signed in and their XP level, so progress is visible from every
 * page rather than only on the profile.
 *
 * WHAT THE UX PASS CHANGED
 *
 *  - There is navigation on a phone. The nav was `hidden sm:flex` with nothing
 *    behind the breakpoint, so below 640px the header was a wordmark and a
 *    Sign out button and every route was unreachable without typing its URL.
 *  - Identity collapsed into <UserNav>. Avatar, level, full name and a Sign out
 *    button were four separate items competing for the same bar — which is why
 *    there was no room for the nav in the first place.
 *  - The active route is marked. Four links styled identically, with nothing
 *    saying which one you are looking at.
 *  - Sign out has a pending state (SubmitButton via SignOutForm).
 */

import Link from 'next/link';
import { logoutAction } from '../../lib/auth/current-user';
import { standingFromXp } from '../../lib/domain/gamification';
import { fullName, initialsOf } from '../../lib/utils';
import { MobileNav } from './mobile-nav';
import { UserNav } from './user-nav';
import { SignOutForm } from './sign-out-form';
import { NavLinks } from './nav-links';
import type { UserPublicRow } from '../../lib/supabase/database.types';

const NAV = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/assessments', label: 'Assessments' },
    { href: '/plan', label: 'Plan' },
    { href: '/profile', label: 'Profile' },
];

export function SiteHeader({ user, xp }: { user: UserPublicRow; xp: number }) {
    const standing = standingFromXp(xp);
    const name = fullName(user.first_name, user.last_name);

    return (
        <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
                {/* Below sm this is the only way to reach any other page. */}
                <MobileNav items={NAV} className="sm:hidden">
                    <SignOutForm action={logoutAction} />
                </MobileNav>

                <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
                    SkillPath
                </Link>

                <NavLinks items={NAV} className="hidden flex-1 sm:flex" label="Main" />

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    <span className="hidden text-xs text-muted-foreground tabular sm:inline">
                        Level {standing.level}
                    </span>

                    {/* Redundant with the menu on a phone, where the menu also
                        shows the name — but on a wide screen it saves a click
                        to answer "who am I signed in as". */}
                    <span className="hidden text-[0.8125rem] md:inline">{name}</span>

                    <UserNav
                        name={name}
                        email={user.email}
                        initials={initialsOf(user.first_name, user.last_name, user.email)}
                        seed={String(user.user_id)}
                        level={standing.level}
                        accountHref="/profile"
                        accountLabel="Your profile"
                        signOut={<SignOutForm action={logoutAction} />}
                    />
                </div>
            </div>
        </header>
    );
}
