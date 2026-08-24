/**
 * Avatar — photo when there is one, initials when there isn't.
 *
 * The initials fallback is not a placeholder to be replaced later; most members
 * will never upload a photo and the page has to look finished for them too.
 * Its background is derived from the member id, so it is stable rather than
 * random on every render.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

const TINTS = [
    'bg-accent-soft text-[color:var(--accent-hover)]',
    'bg-streak-soft text-[color:var(--streak)]',
    'bg-success-soft text-[color:var(--success)]',
    'bg-surface-muted text-muted-foreground',
] as const;

interface AvatarProps {
    src?: string | null;
    initials: string;
    /** Stable input for the fallback tint — the user id works well. */
    seed?: string;
    size?: number;
    className?: string;
}

export function Avatar({ src, initials, seed = '', size = 72, className }: AvatarProps) {
    const tint = TINTS[
        [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TINTS.length
    ];

    return (
        <span
            className={cn(
                'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
                'border border-border',
                src ? 'bg-surface-muted' : tint,
                className,
            )}
            style={{ width: size, height: size }}
        >
            {src ? (
                // Not next/image: these are short-lived signed Storage URLs, so
                // the optimizer would cache a URL that expires in an hour.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt=""
                    width={size}
                    height={size}
                    className="size-full object-cover"
                />
            ) : (
                <span
                    className="font-semibold leading-none"
                    style={{ fontSize: Math.max(12, size * 0.34) }}
                    aria-hidden="true"
                >
                    {initials}
                </span>
            )}
        </span>
    );
}
