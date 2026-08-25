/**
 * The horizontal nav, for viewports wide enough to show it.
 *
 * A client component only because it needs `usePathname` to mark the current
 * route. Both headers previously styled all their links identically, so the nav
 * could tell you where you could go but never where you were.
 *
 * The same `isCurrent` as the mobile panel, so the two cannot disagree about
 * which link is active.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCurrent, type NavItem } from './mobile-nav';
import { cn } from '../../lib/utils';

export function NavLinks({
    items,
    label,
    className,
}: {
    items: NavItem[];
    label: string;
    className?: string;
}) {
    const pathname = usePathname();

    return (
        <nav className={cn('items-center gap-1', className)} aria-label={label}>
            {items.map((item) => {
                const current = isCurrent(pathname, item.href);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                            'interactive rounded-md px-2.5 py-1.5 text-[0.8125rem]',
                            current
                                ? 'bg-surface-muted font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export default NavLinks;
