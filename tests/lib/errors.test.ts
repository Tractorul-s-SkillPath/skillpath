/**
 * Tests for lib/errors.ts.
 *
 * Cases
 *  - every kind has a user-safe message
 *  - a Postgres unique-violation maps to 'conflict'
 *  - a Postgres RLS/permission error maps to 'forbidden', not 'not_found'
 *  - no error message leaks a table name, column name or SQL fragment —
 *    asserted over the whole taxonomy, not one example
 *
 * fromPostgrestError logs the real error on the way through, which is the point
 * of it; console.error is silenced here so a passing run stays readable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appError, fromPostgrestError, type AppErrorCode } from '../../lib/errors';

/** Every Postgres/PostgREST code the translator knows, and what it becomes. */
const MAPPED: ReadonlyArray<[code: string, expected: AppErrorCode]> = [
    ['23505', 'conflict'],
    ['23514', 'validation'],
    ['23503', 'validation'],
    ['42501', 'forbidden'],
    ['PGRST301', 'forbidden'],
    ['PGRST116', 'not_found'],
];

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('appError', () => {
    it('builds the shape every layer passes around', () => {
        expect(appError('not_found', 'Not found.')).toEqual({
            code: 'not_found',
            message: 'Not found.',
            fields: undefined,
        });
    });

    it('carries field-level messages when a form needs them', () => {
        const error = appError('validation', 'Invalid details.', { email: 'Required' });

        expect(error.fields?.email).toBe('Required');
    });
});

describe('fromPostgrestError', () => {
    it.each(MAPPED)('maps %s to "%s"', (code, expected) => {
        expect(fromPostgrestError({ code, message: 'raw database detail' }, 'test').code).toBe(
            expected,
        );
    });

    it('falls back to "unknown" for a code it has never seen', () => {
        const error = fromPostgrestError({ code: '99999', message: 'Fatal exception' }, 'test');

        expect(error.code).toBe('unknown');
        expect(error.message).toBe('Something went wrong. Try again.');
    });

    it('treats an RLS denial as forbidden, never as not_found', () => {
        // Answering "does not exist" to a row the member may not read tells
        // them whether it exists. 42501 and PGRST301 must not collapse into
        // the not_found branch.
        expect(
            fromPostgrestError({ code: '42501', message: 'permission denied' }, 'test').code,
        ).toBe('forbidden');
        expect(fromPostgrestError({ code: 'PGRST301', message: 'jwt missing' }, 'test').code).toBe(
            'forbidden',
        );
    });

    it('never passes the database message through to the member', () => {
        const raw = 'duplicate key value violates unique constraint "categories_name_key"';

        for (const [code] of [...MAPPED, ['99999']] as ReadonlyArray<[string]>) {
            const error = fromPostgrestError({ code, message: raw }, 'category.create');

            expect(error.message).not.toContain(raw);
            expect(error.message).not.toContain('categories');
            expect(error.message).not.toContain(code);
        }
    });

    it('never leaks SQL vocabulary in any message the taxonomy can produce', () => {
        const forbidden =
            /constraint|relation|column|violates|pg_|select |insert |update |delete /i;

        for (const [code] of [...MAPPED, ['99999']] as ReadonlyArray<[string]>) {
            const error = fromPostgrestError(
                { code, message: 'ERROR: relation "profiles" violates check constraint' },
                'test',
            );

            expect(error.message).not.toMatch(forbidden);
        }
    });

    it('logs the real error so the detail is not simply lost', () => {
        fromPostgrestError({ code: '23505', message: 'duplicate key' }, 'category.create');

        expect(console.error).toHaveBeenCalledWith(
            '[db] category.create:',
            '23505',
            'duplicate key',
        );
    });
});
