/**
 * Progress bar.
 *
 * Renders as a real ARIA progressbar: the XP bar is information, not
 * decoration, and a member using a screen reader is owed the number.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps {
    value: number;
    max?: number;
    label: string;
    tone?: 'accent' | 'warm' | 'success';
    className?: string;
}

const TONES = {
    accent: 'bg-accent',
    warm: 'bg-streak',
    success: 'bg-success',
} as const;

export function Progress({ value, max = 100, label, tone = 'accent', className }: ProgressProps) {
    const safeMax = max > 0 ? max : 1;
    const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={Math.round(value)}
            aria-valuemin={0}
            aria-valuemax={safeMax}
            className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}
        >
            <div
                className={cn(
                    'h-full rounded-full transition-[width] duration-500 ease-out',
                    TONES[tone],
                )}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}
