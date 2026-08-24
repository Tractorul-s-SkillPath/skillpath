/**
 * Shared Zod pieces + the form-state shape every Server Action returns.
 *
 * Test: tests/lib/validation/common.test.ts
 */

import { z } from 'zod';

/** What useActionState carries back to a form. */
export interface FormState {
    status: 'idle' | 'success' | 'error';
    message?: string;
    fields?: Record<string, string>;
}

export const IDLE: FormState = { status: 'idle' };

export function formError(message: string, fields?: Record<string, string>): FormState {
    return { status: 'error', message, fields };
}

export function formSuccess(message?: string): FormState {
    return { status: 'success', message };
}

/** Turns a ZodError into the flat field map a form can render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
    const out: Record<string, string> = {};

    for (const issue of error.issues) {
        const key = issue.path.join('.') || 'form';
        out[key] ??= issue.message;
    }

    return out;
}

export const trimmedString = (max: number) =>
    z
        .string()
        .transform((s) => s.trim())
        .pipe(z.string().max(max));

export const categoryId = z.coerce.number().int().positive();

export const skillLevel = z.enum(['beginner', 'intermediate', 'advanced']);
