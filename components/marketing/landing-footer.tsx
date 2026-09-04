/**
 * Landing footer.
 *
 * Story: SP-012
 *
 * Kept to what exists. No pricing page, no careers link, no social icons
 * pointing at accounts nobody has created — a footer full of dead links is
 * worse than a short one.
 */

import Link from 'next/link';

const YEAR = new Date().getFullYear();

export function LandingFooter() {
    return (
        <footer className="bg-surface-muted">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div>
                    <p className="text-sm font-semibold tracking-tight text-foreground">
                        SkillPath
                    </p>
                    <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                        Assess a skill, find the gaps, work the plan.
                    </p>
                </div>

                <div className="flex items-center gap-5 text-[0.8125rem]">
                    <a
                        href="#how-it-works"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        How it works
                    </a>
                    <Link
                        href="/login"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/register"
                        className="font-medium text-foreground transition-colors hover:text-[color:var(--accent-hover)]"
                    >
                        Get started
                    </Link>
                </div>
            </div>

            <div className="border-t border-border">
                <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
                    {/* Same reason as the hero's trust line: subtle-foreground at 12px
                     * does not clear 4.5:1 against this band. */}
                    <p className="text-xs text-muted-foreground tabular">© {YEAR} SkillPath</p>
                </div>
            </div>
        </footer>
    );
}
