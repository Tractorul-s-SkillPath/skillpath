/**
 * AppError — the one error shape that crosses layers.
 *
 * ARCHITECTURE §8. A Postgres error code is not something a form can render,
 * and a raw database message is not something a stranger should read.
 *
 * Test: tests/lib/errors.test.ts
 */

export type AppErrorCode =
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'validation'
    | 'conflict'
    | 'unavailable'
    | 'unknown';

export interface AppError {
    code: AppErrorCode;
    /** Safe to show a member. Never contains a database message. */
    message: string;
    /** Field-level messages for a form, keyed by field name. */
    fields?: Record<string, string>;
}

export function appError(
    code: AppErrorCode,
    message: string,
    fields?: Record<string, string>,
): AppError {
    return { code, message, fields };
}

/**
 * Postgres and PostgREST errors, translated once.
 *
 * The full error is logged; the member gets a sentence. RLS denials arrive as
 * 42501 or as an empty result — both mean "not yours", never "does not exist",
 * because saying which one leaks whether the row is real.
 */
export function fromPostgrestError(
    error: { code?: string; message: string },
    context: string,
): AppError {
    console.error(`[db] ${context}:`, error.code, error.message);

    switch (error.code) {
        case '23505':
            return appError('conflict', 'That already exists.');
        case '23514':
            return appError('validation', "That value isn't allowed.");
        case '23503':
            return appError('validation', 'That refers to something that no longer exists.');
        case '42501':
        case 'PGRST301':
            return appError('forbidden', "You don't have access to that.");
        case 'PGRST116':
            return appError('not_found', 'Not found.');
        default:
            return appError('unknown', 'Something went wrong. Try again.');
    }
}
