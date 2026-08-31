import { describe, it, expect } from 'vitest';
import { categorySchema } from '../../../lib/validation/category.schema';

describe('Category Validation', () => {
  it('respinge un nume de categorie prea scurt (sub 2 caractere)', () => {
    const result = categorySchema.safeParse({ name: 'A', description: 'Valid' });
    expect(result.success).toBe(false);
  });

  it('respinge un nume de categorie peste 60 de caractere', () => {
    const longName = 'A'.repeat(61);
    const result = categorySchema.safeParse({ name: longName, description: 'Valid' });
    expect(result.success).toBe(false);
  });
});