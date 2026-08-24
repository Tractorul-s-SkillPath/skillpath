/**
 * Chip — a small labelled pill. Interests, levels, statuses.
 *
 * Tone carries meaning, so it is never picked for decoration: `accent` means
 * active or assessed, `warm` is reserved for streaks, `muted` is neutral.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'muted' | 'accent' | 'warm' | 'success' | 'danger';

const TONES: Record<Tone, string> = {
    muted: 'border-border bg-surface-muted text-muted-foreground',
    accent: 'border-transparent bg-accent-soft text-[color:var(--accent-hover)]',
    warm: 'border-transparent bg-streak-soft text-[color:var(--streak)]',
    success: 'border-transparent bg-success-soft text-[color:var(--success)]',
    danger: 'border-transparent bg-danger-soft text-[color:var(--danger)]',
};

export interface ChipProps extends React.ComponentProps<'span'> {
    tone?: Tone;
}

export function Chip({ tone = 'muted', className, ...props }: ChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                'text-xs font-medium leading-none',
                TONES[tone],
                className,
            )}
            {...props}
        />
    );
}
