/**
 * Site header.
 *
 * Story: SP-012
 *
 * Shows who is signed in and their XP level, so progress is visible from every
 * page rather than only on the profile.
 */

import Link from 'next/link';
import { logoutAction } from '../../lib/auth/current-user';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { standingFromXp } from '../../lib/domain/gamification';
import { fullName, initialsOf } from '../../lib/utils';
import type { UserPublicRow } from '../../lib/supabase/database.types';

const NAV = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/assessments/new', label: 'Assessments' },
    { href: '/plan', label: 'Plan' },
    { href: '/profile', label: 'Profile' },
];

export function SiteHeader({ user, xp }: { user: UserPublicRow; xp: number }) {
    const standing = standingFromXp(xp);

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
                <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
                    SkillPath
                </Link>

                <nav className="hidden flex-1 items-center gap-1 sm:flex" aria-label="Main">
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
                    <span className="hidden text-xs text-muted-foreground tabular sm:inline">
                        Level {standing.level}
                    </span>

                    <Link href="/profile" aria-label="Your profile">
                        <Avatar
                            initials={initialsOf(user.first_name, user.last_name, user.email)}
                            seed={String(user.user_id)}
                            size={28}
                        />
                    </Link>

                    <span className="hidden text-[0.8125rem] md:inline">
                        {fullName(user.first_name, user.last_name)}
                    </span>

                    <form action={logoutAction}>
                        <Button type="submit" size="sm" variant="ghost">
                            Sign out
                        </Button>
                    </form>
                </div>
            </div>
        </header>
    );
}
