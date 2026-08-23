/**
 * Section — the profile page's spine.
 *
 * A titled block with an optional action on the right. Every section of the
 * page is one of these, which is why they line up without anybody nudging
 * margins.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

interface SectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
    title: string;
    description?: string;
    /** Rendered top-right — an Edit button, a count, a toggle. */
    action?: React.ReactNode;
    /** Small text under the title, e.g. "self-declared". */
    meta?: React.ReactNode;
}

export function Section({
    title,
    description,
    action,
    meta,
    className,
    children,
    ...props
}: SectionProps) {
    return (
        <section
            className={cn(
                'scroll-mt-24 rounded-[var(--radius-card)] border border-border bg-surface',
                className,
            )}
            {...props}
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                        {title}
                    </h2>
                    {description ? (
                        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                    {meta}
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </header>
            <div className="px-5 py-5 sm:px-6">{children}</div>
        </section>
    );
}
