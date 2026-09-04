/**
 * Login and registration schemas.
 *
 * Stories: SP-010, SP-011
 *
 * Sketch
 *  loginSchema     email + password, present and shaped
 *  registerSchema  first/last name (<= 60, matching the SQL check), email,
 *                  password policy, confirm password refine
 *
 * The password policy lives here so client and server reject identically
 * (SP-011 AC3).
 *
 * Test: tests/lib/validation/auth.schema.test.ts
 */

import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(1, { message: 'Password is required' }),
});

export const registerSchema = z
    .object({
        name: z.string().max(60, { message: 'Name must be at most 60 characters' }),
        email: z.string().email({ message: 'Invalid email address' }),
        password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
