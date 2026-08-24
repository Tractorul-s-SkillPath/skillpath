/**
 * EmptyState — what a section looks like before it has anything in it.
 *
 * Story: SP-073
 *
 * A brand-new member sees six of these on one page, so each one names the
 * single next action rather than apologising for being empty. Never a spinner,
 * never a bare "No data".
 */

import * as React from 'react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center rounded-lg border border-dashed border-border-strong',
                'px-6 py-8 text-center',
                className,
            )}
        >
            {icon ? <div className="mb-3 text-subtle-foreground">{icon}</div> : null}
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description ? (
                <p className="mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {description}
                </p>
            ) : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

export default EmptyState;
