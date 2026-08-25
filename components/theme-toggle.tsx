/**
 * Theme control.
 *
 * The tokens in globals.css already supported three states before this existed
 * — `.dark`, `.light`, and neither (follow the OS via prefers-color-scheme).
 * There was simply nothing in the UI that could set them, so every member got
 * whatever their system was set to and could not disagree with it.
 *
 * SYSTEM IS A REAL STATE, NOT A DEFAULT THAT DECAYS
 *
 * A two-way light/dark switch has to pick a side the first time you touch it,
 * and from then on the app stops following the OS forever. So the stored value
 * is one of three, and 'system' means "remove both classes and let the media
 * query decide" — which keeps working when the OS flips at sunset.
 *
 * Two shapes, one behaviour:
 *  - `variant="icon"`   a single button that cycles. For the marketing header,
 *                       where there is no menu to put options inside.
 *  - `variant="options"` three labelled radio buttons. For the user menu, where
 *                       there is room to say what the choices are.
 *
 * The flash-of-wrong-theme is handled in app/layout.tsx, not here: a component
 * cannot run before first paint, and a class applied in useEffect arrives one
 * frame too late to help.
 */

'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'skillpath-theme';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
];

/** Single source of truth for what a theme does to the document. */
function apply(theme: Theme) {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');

    // Native controls — scrollbars, form widgets, the URL bar on mobile — read
    // this, not our classes. Without it a dark page keeps light scrollbars.
    root.style.colorScheme = theme === 'system' ? '' : theme;
}

function read(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function ThemeToggle({
    variant = 'icon',
    className,
}: {
    variant?: 'icon' | 'options';
    className?: string;
}) {
    // 'system' until mounted. The server has no idea what the browser prefers,
    // so rendering the real value on the first pass would be a hydration
    // mismatch — the button gets its label from `mounted` instead.
    const [theme, setTheme] = React.useState<Theme>('system');
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setTheme(read());
        setMounted(true);
    }, []);

    const choose = React.useCallback((next: Theme) => {
        setTheme(next);
        apply(next);

        // 'system' is stored as absence. Writing the string would be a second
        // way to spell the same state and the inline script would have to know
        // about both.
        if (next === 'system') {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    if (variant === 'options') {
        return (
            <div
                role="radiogroup"
                aria-label="Colour theme"
                className={cn('flex gap-1 rounded-lg bg-surface-muted p-1', className)}
            >
                {OPTIONS.map(({ value, label, Icon }) => {
                    const active = mounted && theme === value;

                    return (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => choose(value)}
                            className={cn(
                                'interactive flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5',
                                // Never wrap: a two-line "Sys / tem" is worse
                                // than any overflow it would be avoiding.
                                'whitespace-nowrap text-xs font-medium',
                                active
                                    ? 'bg-surface text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    }

    // Cycling light -> dark -> system keeps 'system' reachable from a control
    // with only one hit target, which a plain two-way switch cannot do.
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    const { Icon, label } = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];

    return (
        <button
            type="button"
            onClick={() => choose(next)}
            // Before mount the icon is a guess, so the accessible name must not
            // claim a specific current theme.
            aria-label={mounted ? `Theme: ${label}. Switch to ${next}.` : 'Change theme'}
            title={mounted ? `Theme: ${label}` : 'Change theme'}
            className={cn(
                'interactive inline-flex size-8 items-center justify-center rounded-lg',
                'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                className,
            )}
        >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
    );
}

export default ThemeToggle;
