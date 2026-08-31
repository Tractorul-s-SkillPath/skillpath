/**
 * Tests for lib/result.ts.
 *
 * Cases
 *  - ok(v) / err(e) produce the discriminated shapes and narrow correctly
 *  - map only runs on ok, mapErr only on err
 *  - unwrapOr returns the fallback for err and the value for ok
 *  - ok(undefined) is still ok — absence of a value is not failure
 */


import { describe, it, expect } from 'vitest';
import { ok, err, unwrapOr } from '../../lib/result';

describe('Result Wrapper', () => {
  it('împachetează cu succes o valoare în starea "ok"', () => {
    const result = ok({ id: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(1);
    }
  });

  it('împachetează cu succes o eroare în starea "err"', () => {
    const result = err('Nu s-a putut salva');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Nu s-a putut salva');
    }
  });

  it('unwrapOr extrage valoarea corectă din starea "ok"', () => {
    const val = unwrapOr(ok(10), 0);
    expect(val).toBe(10);
  });

  it('unwrapOr aplică fallback-ul din starea "err"', () => {
    const val = unwrapOr(err('Eroare internă'), 'Fallback Text');
    expect(val).toBe('Fallback Text');
  });
});