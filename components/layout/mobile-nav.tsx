/**
 * Mobile navigation.
 *
 * WHY THIS FILE EXISTS
 *
 * Both headers rendered their nav as `hidden sm:flex` (student) and
 * `hidden md:flex` (admin) with nothing behind the breakpoint. On a phone the
 * header was a wordmark and a Sign out button: Dashboard, Assessments, Plan,
 * Profile and all five admin sections were simply unreachable unless you knew
 * the URL and typed it. This is the other half of that breakpoint.
 *
 * A disclosure panel, not a drawer. The nav is at most five links, so a
 * full-screen overlay with a scrim and a focus trap would be more machinery
 * than the content justifies — and every piece of that machinery is somewhere
 * else for a keyboard user to get stuck.
 *
 * The current route is marked with aria-current so the panel answers "where am
 * I" as well as "where can I go".
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useDismiss } from '../use-dismiss';
import { cn } from '../../lib/utils';

export interface NavItem {
    href: string;
    label: string;
}

/**
 * Exact match, or a real path segment beneath it.
 *
 * `startsWith` alone would light up /admin for every admin page, and
 * `/plan` for a hypothetical `/planning`.
 */
export function isCurrent(pathname: string, href: string): boolean {
    if (pathname === href) return true;
    if (href === '/' || href === '/admin' || href === '/dashboard') return false;

    return pathname.startsWith(`${href}/`);
}

export function MobileNav({
    items,
    className,
    children,
}: {
    items: NavItem[];
    className?: string;
    /**
     * Rendered at the foot of the open panel. The sign-out form lives in the
     * server layout — this component cannot import the action itself, since
     * lib/auth/current-user.ts is server-only — so it arrives as a slot.
     */
    children?: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(false);
    const pathname = usePathname();
    const close = React.useCallback(() => setOpen(false), []);
    const ref = useDismiss<HTMLDivElement>(open, close);

    // Navigating with the panel open leaves it open over the new page,
    // because App Router transitions do not unmount the layout.
    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div ref={ref} className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-nav-panel"
                aria-label={open ? 'Close menu' : 'Open menu'}
                className={cn(
                    'interactive inline-flex size-8 items-center justify-center rounded-lg',
                    'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )}
            >
                {open ? (
                    <X size={17} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                    <Menu size={17} strokeWidth={1.75} aria-hidden="true" />
                )}
            </button>

            {open ? (
                <div
                    id="mobile-nav-panel"
                    className={cn(
                        'rise absolute left-0 top-[calc(100%+0.5rem)] z-20 w-56 origin-top-left',
                        'rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-lg',
                    )}
                >
                    <nav aria-label="Main" className="flex flex-col">
                        {items.map((item) => {
                            const current = isCurrent(pathname, item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={current ? 'page' : undefined}
                                    className={cn(
                                        'interactive rounded-md px-3 py-2 text-[0.8125rem]',
                                        current
                                            ? 'bg-accent-soft font-medium text-[color:var(--accent-hover)]'
                                            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {children ? (
                        <div className="mt-1.5 border-t border-border pt-1.5">{children}</div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default MobileNav;
