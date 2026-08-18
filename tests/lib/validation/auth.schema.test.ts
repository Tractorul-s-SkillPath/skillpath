/**
 * Tests for lib/validation/auth.schema.ts.
 *
 * Stories: SP-010, SP-011
 *
 * Cases
 *  - valid login parses; missing email or password gives a field error
 *  - malformed email rejected
 *  - a weak password is rejected with a message (SP-011 AC3)
 *  - confirm-password mismatch is a field error on confirm, not a form error
 *  - a 61-character name is rejected — same bound as the SQL check
 */
