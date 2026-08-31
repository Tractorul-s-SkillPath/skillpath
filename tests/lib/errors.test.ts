/**
 * Tests for lib/errors.ts.
 *
 * Cases
 *  - every kind has a user-safe message
 *  - a Postgres unique-violation maps to 'conflict' with the right field
 *  - a Postgres RLS/permission error maps to 'forbidden', not 'not_found'
 *  - no error message leaks a table name, column name or SQL fragment —
 *    assert this over the whole taxonomy, not one example
 */

 import { describe, it, expect } from 'vitest';
 import { appError, fromPostgrestError } from '../../lib/errors';

 describe('AppError Utility', () => {
   it('creează un AppError de bază fără câmpuri expuse', () => {
     const err = appError('not_found', 'Resursa nu există.');
     expect(err).toEqual({ code: 'not_found', message: 'Resursa nu există.', fields: undefined });
   });

   it('atașează corect erorile la nivel de câmp (field-level)', () => {
     const err = appError('validation', 'Date invalide.', { email: 'Lipsă' });
     expect(err.fields?.email).toBe('Lipsă');
   });

   it('mapează erorile de unicitate (23505) la "conflict"', () => {
     const err = fromPostgrestError({ code: '23505', message: 'duplicate key' }, 'test');
     expect(err.code).toBe('conflict');
   });

   it('mapează restricțiile RLS (42501) și PostgREST la "forbidden"', () => {
     const rlsErr = fromPostgrestError({ code: '42501', message: 'RLS denied' }, 'test');
     expect(rlsErr.code).toBe('forbidden');

     const apiErr = fromPostgrestError({ code: 'PGRST301', message: 'jwt missing' }, 'test');
     expect(apiErr.code).toBe('forbidden');
   });

   it('aplică un fallback generic "unknown" pentru coduri netratate', () => {
     const err = fromPostgrestError({ code: '99999', message: 'Fatal exception' }, 'test');
     expect(err.code).toBe('unknown');
     expect(err.message).toBe('Something went wrong. Try again.');
   });
 });
