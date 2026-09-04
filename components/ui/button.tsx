/**
 * Button. Four variants, three sizes, no more.
 *
 * Every variant keeps the shared focus ring from globals.css. Removing a focus
 * outline without replacing it is how a page stops being keyboard-usable.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
    primary: 'bg-accent text-accent-foreground hover:bg-accent-hover disabled:hover:bg-accent',
    secondary:
        'border border-border-strong bg-surface text-foreground hover:bg-surface-muted disabled:hover:bg-surface',
    ghost: 'text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:hover:bg-transparent',
    danger: 'border border-border-strong bg-surface text-danger hover:bg-danger-soft disabled:hover:bg-surface',
};

const SIZES: Record<Size, string> = {
    sm: 'h-8 gap-1.5 px-3 text-[0.8125rem]',
    md: 'h-9.5 gap-2 px-4 text-sm',
    icon: 'size-9 justify-center',
};

/**
 * The same styling for a link that acts like a button.
 *
 * A <Link> inside a <button> — or a <button> inside a <Link> — is invalid HTML
 * and behaves badly for keyboard and screen-reader users. Anything that
 * navigates is an anchor wearing these classes; anything that acts is a Button.
 */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
    return cn(
        'inline-flex select-none items-center rounded-lg font-medium transition-colors',
        VARIANTS[variant],
        SIZES[size],
        className,
    );
}

export interface ButtonProps extends React.ComponentProps<'button'> {
    variant?: Variant;
    size?: Size;
}

export function Button({
    variant = 'secondary',
    size = 'md',
    className,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(
                'inline-flex select-none items-center rounded-lg font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-55',
                VARIANTS[variant],
                SIZES[size],
                className,
            )}
            {...props}
        />
    );
}
