/**
 * Heading block for a landing-page section.
 *
 * Story: SP-012
 *
 * The landing page is five sections that all open the same way — small label,
 * headline, one paragraph. Putting that shape here is what stops the fourth
 * section from quietly having different spacing than the first.
 *
 * `id` lands on the <h2> so a section can point `aria-labelledby` at it.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeadingProps {
    id: string;
    eyebrow: string;
    title: string;
    description?: string;
    align?: 'left' | 'center';
    className?: string;
}

export function SectionHeading({
    id,
    eyebrow,
    title,
    description,
    align = 'center',
    className,
}: SectionHeadingProps) {
    return (
        <div
            className={cn(
                'max-w-2xl',
                align === 'center' ? 'mx-auto text-center' : '',
                className,
            )}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-hover)]">
                {eyebrow}
            </p>

            <h2
                id={id}
                className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
                {title}
            </h2>

            {description ? (
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base">
                    {description}
                </p>
            ) : null}
        </div>
    );
}
