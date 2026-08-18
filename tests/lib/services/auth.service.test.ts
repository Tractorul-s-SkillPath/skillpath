/**
 * Tests for lib/services/auth.service.ts.
 *
 * Stories: SP-010, SP-011, SP-014
 *
 * Cases
 *  - valid credentials -> ok(session)
 *  - wrong password and unknown email produce the SAME error message (SP-010 AC2)
 *  - status='inactive' -> 'account disabled', and no session is returned (SP-014)
 *  - register passes first/last name as user metadata (the trigger needs it)
 *  - register never inserts into profiles itself
 *  - duplicate email -> conflict on the email field, no user created
 */
