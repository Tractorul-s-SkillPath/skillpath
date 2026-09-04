/**
 * User menu.
 *
 * Story: SP-010
 *
 * This file was an eight-line comment describing what it would do, imported by
 * nothing. Both headers instead laid the avatar, the level, the full name and a
 * Sign out button flat across the bar — which is most of the reason the header
 * had no room left for navigation on a phone.
 *
 * Everything about the member now lives behind one hit target: identity, XP
 * standing, a link to the profile, the theme control, and sign out.
 *
 * The trigger is the avatar. It stays a button rather than becoming a link to
 * /profile, because a control that navigates on click and opens a menu on some
 * other gesture is a control you cannot predict.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useDismiss } from '../use-dismiss';
import { Avatar } from '../ui/avatar';
import { ThemeToggle } from '../theme-toggle';
import { cn } from '../../lib/utils';

interface UserNavProps {
    name: string;
    email: string;
    initials: string;
    /** Stable avatar tint. The user id, so it never changes under a rename. */
    seed: string;
    /** Omitted for admins, who have no XP standing. */
    level?: number;
    /**
     * Where "your account" goes. This was hardcoded to /profile, which sent
     * admins into the student route group and out of their own shell — the two
     * roles have genuinely different pages, so the header that knows the role
     * picks the destination.
     */
    accountHref: string;
    accountLabel: string;
    /**
     * The sign-out form. Built in the server layout and passed down: this is a
     * client component and lib/auth/current-user.ts is server-only, so the
     * action cannot be imported here.
     */
    signOut: React.ReactNode;
}

export function UserNav({
    name,
    email,
    initials,
    seed,
    level,
    accountHref,
    accountLabel,
    signOut,
}: UserNavProps) {
    const [open, setOpen] = React.useState(false);
    const pathname = usePathname();
    const close = React.useCallback(() => setOpen(false), []);
    const ref = useDismiss<HTMLDivElement>(open, close);

    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls="user-menu-panel"
                aria-label={`Account menu for ${name}`}
                className={cn(
                    'interactive flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5',
                    'hover:bg-surface-muted',
                )}
            >
                <Avatar initials={initials} seed={seed} size={28} />
                <ChevronDown
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={cn('interactive text-subtle-foreground', open && 'rotate-180')}
                />
            </button>

            {open ? (
                <div
                    id="user-menu-panel"
                    className={cn(
                        // w-68, not w-60: the theme control is three equal
                        // cells, so the widest label ("System") sets the
                        // minimum for all three. At w-60 each cell got ~68px
                        // and needed ~75px, so the row pushed past the panel.
                        'rise absolute right-0 top-[calc(100%+0.5rem)] z-20 w-68 origin-top-right',
                        'rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-lg',
                    )}
                >
                    <div className="px-2.5 py-2">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">
                            {name}
                        </p>
                        {/* Long addresses are the norm, and a menu that widens
                            to fit one is worse than a truncated address. */}
                        <p className="truncate text-xs text-muted-foreground" title={email}>
                            {email}
                        </p>
                        {level !== undefined ? (
                            <p className="mt-1.5 text-xs text-subtle-foreground tabular">
                                Level {level}
                            </p>
                        ) : null}
                    </div>

                    <div className="border-t border-border pt-1.5">
                        <Link
                            href={accountHref}
                            className={cn(
                                'interactive block rounded-md px-2.5 py-2 text-[0.8125rem]',
                                'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                            )}
                        >
                            {accountLabel}
                        </Link>
                    </div>

                    <div className="border-t border-border px-2.5 py-2">
                        <p className="mb-1.5 text-xs font-medium text-subtle-foreground">Theme</p>
                        <ThemeToggle variant="options" />
                    </div>

                    <div className="border-t border-border pt-1.5">{signOut}</div>
                </div>
            ) : null}
        </div>
    );
}

export default UserNav;
