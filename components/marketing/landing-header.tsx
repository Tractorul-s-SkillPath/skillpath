/**
 * Landing header — the signed-out counterpart to <SiteHeader>.
 *
 * Story: SP-012
 *
 * Deliberately not a variant of SiteHeader: that one exists to show who you
 * are and how much XP you have, and every line of it assumes a user. A
 * signed-out visitor needs the opposite — the two doors in and a way to skim
 * the page — so it is a separate component rather than a component full of
 * `user ? … : …`.
 *
 * Same height, same wordmark position and the same blur as SiteHeader, so
 * signing in doesn't shift the page under you.
 */

import Link from 'next/link';
import { buttonClass } from '../ui/button';
import { ThemeToggle } from '../theme-toggle';

const SECTIONS = [
    { href: '#how-it-works', label: 'How it works' },
    { href: '#features', label: 'Features' },
    { href: '#progress', label: 'Progress' },
];

export function LandingHeader() {
    return (
        <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-5 sm:px-8">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                    SkillPath
                </Link>

                <nav
                    className="hidden flex-1 items-center gap-1 md:flex"
                    aria-label="Page sections"
                >
                    {SECTIONS.map((section) => (
                        <a
                            key={section.href}
                            href={section.href}
                            className="rounded-md px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                        >
                            {section.label}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    {/* The icon variant, not the three options: a signed-out
                        visitor has no menu to put them in. */}
                    <ThemeToggle />

                    <Link href="/login" className={buttonClass('ghost', 'sm')}>
                        Sign in
                    </Link>
                    <Link href="/register" className={buttonClass('primary', 'sm')}>
                        Get started
                    </Link>
                </div>
            </div>
        </header>
    );
}
