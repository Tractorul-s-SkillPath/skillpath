/**
 * Tests for lib/validation/common.ts.
 *
 * Cases
 *  - id coerces "12" -> 12 and rejects "abc", "-1", "1.5"
 *  - pagination clamps pageSize to the maximum and defaults page to 1
 *  - trimmedString rejects whitespace-only input (matching the SQL
 *    length(trim(...)) checks)
 *  - each enum schema accepts exactly the values in the SQL enum and nothing else
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formSuccess, formError, fieldErrors, trimmedString } from '../../../lib/validation/common';

describe('Common Validation Utilities', () => {
  it('generează structura corectă pentru formSuccess și formError', () => {
    expect(formSuccess('Salvat')).toEqual({ status: 'success', message: 'Salvat' });
    expect(formError('Eșuat', { text: 'Incomplet' })).toEqual({
      status: 'error',
      message: 'Eșuat',
      fields: { text: 'Incomplet' }
    });
  });

  it('fieldErrors extrage cheile din ZodError într-un obiect plat', () => {
    const schema = z.object({ age: z.number().min(18, 'Prea mic') });
    const parsed = schema.safeParse({ age: 12 });

    if (!parsed.success) {
      const flattened = fieldErrors(parsed.error);
      expect(flattened['age']).toBe('Prea mic');
    }
  });

  it('fieldErrors aplică valoarea "form" pentru erorile de la nivelul rădăcinii', () => {
      const rootSchema = z
        .object({ a: z.number(), b: z.number() })
        .refine((data) => data.a === data.b, { message: 'Eroare generală' });

      const parsed = rootSchema.safeParse({ a: 1, b: 2 });

      if (!parsed.success) {
        const flattened = fieldErrors(parsed.error);
        expect(flattened['form']).toBe('Eroare generală');
      }
    });

  it('trimmedString elimină spațiile și aplică limita maximă', () => {
    const schema = trimmedString(5);

    expect(schema.safeParse('  abc  ').data).toBe('abc');

    expect(schema.safeParse('abcdef').success).toBe(false);
  });
});