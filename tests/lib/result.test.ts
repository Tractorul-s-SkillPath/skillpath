/**
 * Tests for lib/result.ts.
 *
 * Cases
 *  - ok(v) / err(e) produce the discriminated shapes and narrow correctly
 *  - unwrapOr returns the fallback for err and the value for ok
 *  - ok(undefined) is still ok — absence of a value is not failure
 */

import { describe, it, expect } from 'vitest';
import { ok, err, unwrapOr } from '../../lib/result';

describe('ok', () => {
    it('wraps a value in the success shape', () => {
        const result = ok({ id: 1 });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toEqual({ id: 1 });
    });

    it('treats undefined as a value, not as a failure', () => {
        // A repository that found nothing returns ok(null); only a broken
        // query returns err. Collapsing the two would make "no rows" an error
        // everywhere it is checked.
        const result = ok(undefined);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBeUndefined();
    });
});

describe('err', () => {
    it('wraps an error in the failure shape', () => {
        const result = err('Could not save');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error).toBe('Could not save');
    });
});

describe('unwrapOr', () => {
    it('returns the value when the result is ok', () => {
        expect(unwrapOr(ok(10), 0)).toBe(10);
    });

    it('returns the fallback when the result is err', () => {
        expect(unwrapOr(err('Internal error'), 'Fallback')).toBe('Fallback');
    });

    it('returns a falsy value rather than reaching for the fallback', () => {
        // ok(0) and ok('') are values. A `||` implementation would hand back
        // the fallback for both.
        expect(unwrapOr(ok(0), 99)).toBe(0);
        expect(unwrapOr(ok(''), 'fallback')).toBe('');
    });
});
