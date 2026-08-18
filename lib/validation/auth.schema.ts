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
