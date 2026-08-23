/**
 * Small shared helpers. If something here grows a business rule, it belongs in
 * lib/domain instead.
 *
 * Test: tests/lib/utils.test.ts
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names, letting a caller's utility win over a component default. */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/** "12 Aug 2026" — unambiguous, and the same in every locale that reads it. */
export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

/** Percentages print as whole numbers unless the decimal carries information. */
export function formatScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '—';
    return Number.isInteger(score) ? `${score}%` : `${score.toFixed(1)}%`;
}

export function initialsOf(firstName: string, lastName: string, email: string): string {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);

    if (first || last) return `${first}${last}`.toUpperCase();
    return email.charAt(0).toUpperCase() || '?';
}

export function fullName(firstName: string, lastName: string, fallback = 'Member'): string {
    const name = `${firstName} ${lastName}`.trim();
    return name || fallback;
}
