import { describe, it, expect } from 'vitest';
import { nameSchema, interestsSchema } from '../../../lib/validation/profile.schema';

describe('Profile Validation', () => {
  it('acceptă modificarea validă a numelui', () => {
    const validProfileUpdate = {
      firstName: 'Maria',
      lastName: 'Ionescu'
    };
    expect(nameSchema.safeParse(validProfileUpdate).success).toBe(true);
  });

  it('blochează escaladarea rolului prin eliminarea cheilor necunoscute (SP-013 / SP-021)', () => {
    const maliciousUpdate = {
      firstName: 'Hacker',
      lastName: 'Test',
      role: 'admin'
    };

    const result = nameSchema.safeParse(maliciousUpdate);
    expect(result.success).toBe(true);
    expect((result.data as any).role).toBeUndefined();
  });

  it('validează un array de ID-uri numerice pentru interese', () => {
    const result = interestsSchema.safeParse({ categoryIds: [1, 2, 3] });
    expect(result.success).toBe(true);
  });
});