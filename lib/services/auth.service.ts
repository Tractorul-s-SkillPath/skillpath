/**
 * Authentication.
 *
 * Layer: SERVICE
 * Stories: SP-010, SP-011, SP-014
 *
 * Sketch
 *  login(email, password): Result<Session>
 *   - one generic error for every credential failure (SP-010 AC2)
 *   - status='inactive' -> 'account disabled' (SP-014), checked AFTER the
 *     password so we do not leak which emails exist
 *  register(input): Result<UserId>
 *   - signUp with first/last name in user metadata; the trigger writes profiles
 *   - duplicate email -> AppError 'conflict' on the email field
 *  logout()
 *
 * Test: tests/lib/services/auth.service.test.ts
 */
