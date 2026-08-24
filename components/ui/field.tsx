/**
 * Form primitives: Label, Input, Field.
 *
 * Field wires the label, the control and its error message together with ids
 * and aria-describedby, because an error a screen reader never announces is an
 * error the member never fixes.
 *
 * That sentence has been in this file from the start and was not true: Field
 * rendered `{children}` untouched, so the error paragraph got an id that
 * nothing pointed at and `aria-invalid` was never set. It clones the control
 * now, which is what makes the claim honest.
 */

'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

const CONTROL =
    'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground ' +
    'placeholder:text-subtle-foreground transition-colors ' +
    'hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ' +
    'aria-[invalid=true]:border-[color:var(--danger)]';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
    return <input className={cn(CONTROL, 'h-9.5', className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
    return (
        <label
            className={cn('block text-[0.8125rem] font-medium text-foreground', className)}
            {...props}
        />
    );
}

interface FieldProps {
    label: string;
    /** Must match the `id` of the control passed as `children`. */
    htmlFor: string;
    error?: string;
    hint?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
    const errorId = `${htmlFor}-error`;

    // The control is told about its own error. Passing a single element is the
    // normal case; anything else renders as-is rather than throwing.
    const control = React.isValidElement<Record<string, unknown>>(children)
        ? React.cloneElement(children, {
              'aria-invalid': error ? true : undefined,
              'aria-describedby': error ? errorId : undefined,
          })
        : children;

    return (
        <div className={cn('space-y-1.5', className)}>
            <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={htmlFor}>{label}</Label>
                {hint ? <span className="text-xs text-subtle-foreground tabular">{hint}</span> : null}
            </div>
            {control}
            {error ? (
                <p id={errorId} className="text-xs text-danger" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
