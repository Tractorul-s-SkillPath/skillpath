import { describe, it, expect } from 'vitest';
import { userFiltersSchema, resultFiltersSchema } from '../../../lib/validation/filters.schema';

describe('Filters Validation', () => {
  it('validează și transformă tipurile pentru filtrele de utilizatori', () => {
    const urlParams = {
      search: '   ion   ',
      role: 'student',
      page: '2'
    };
    const result = userFiltersSchema.safeParse(urlParams);
    expect(result.success).toBe(true);
    expect(result.data?.search).toBe('ion');
    expect(result.data?.page).toBe(2);
  });

  it('aplică valorile de fallback (catch) pentru input invalid', () => {
    const emptyParams = { sort: 'invalid_sort_value', page: 'junk' };
    const result = resultFiltersSchema.safeParse(emptyParams);
    expect(result.success).toBe(true);
    expect(result.data?.sort).toBe('date_desc');
    expect(result.data?.page).toBe(1);
  });
});