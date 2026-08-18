/**
 * Tests for app/(auth)/register/actions.ts.
 *
 * Story: SP-011
 *
 * Cases
 *  - invalid input -> field errors, no service call
 *  - first/last name are passed as user metadata so the trigger can use them
 *  - the action itself never inserts into profiles
 *  - duplicate email -> a field error on `email`, nothing created (SP-011 AC2)
 *  - a weak password is rejected server-side even when the client is bypassed
 */
