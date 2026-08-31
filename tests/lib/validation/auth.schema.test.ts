import { describe, it, expect } from 'vitest';
import { registerSchema } from '../../../lib/validation/auth.schema';

describe('Auth Validation - registerSchema', () => {
  it('validează un payload corect de înregistrare', () => {
    const validData = {
      name: 'Ion Popescu',
      email: 'student@test.com',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!'
    };
    expect(registerSchema.safeParse(validData).success).toBe(true);
  });

  it('respinge înregistrarea dacă parolele nu coincid', () => {
    const invalidData = {
      name: 'Ion Popescu',
      email: 'student@test.com',
      password: 'StrongPassword123!',
      confirmPassword: 'AltaParola456!'
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});