/**
 * Closing call to action.
 *
 * Story: SP-012
 *
 * A visitor who scrolled this far has read the whole argument; the only thing
 * left to do is remove the excuse. Hence the specific promise — one
 * assessment, and you leave with a plan — rather than "get started today".
 */

import Link from 'next/link';
import { buttonClass } from '../ui/button';

export function FinalCta() {
    return (
        <section aria-labelledby="cta-title" className="border-b border-border">
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
                <div className="rounded-[var(--radius-card)] border border-border bg-accent-soft px-6 py-12 text-center sm:px-12">
                    <h2
                        id="cta-title"
                        className="mx-auto max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                    >
                        Take one assessment. Leave with a plan.
                    </h2>

                    {/* The accent-soft panel is lighter than the page, so
                     * muted-foreground drops to 4.39:1 here — just under AA.
                     * A translucent foreground keeps the softer look and clears it. */}
                    <p className="mx-auto mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-foreground/70">
                        Ten minutes is enough to find out where you actually stand in a skill you
                        thought you knew.
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link
                            href="/register"
                            className={buttonClass('primary', 'md', 'h-11 px-6 text-[0.9375rem]')}
                        >
                            Create your account
                        </Link>
                        <Link
                            href="/login"
                            className={buttonClass('secondary', 'md', 'h-11 px-6 text-[0.9375rem]')}
                        >
                            I already have one
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
