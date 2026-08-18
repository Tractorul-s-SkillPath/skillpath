/**
 * Tests for lib/auth/assertAuth.ts.
 *
 * Stories: SP-012, SP-014
 *
 * Cases
 *  - anonymous -> redirects to /login
 *  - active user -> returns the user id
 *  - inactive user -> refused (SP-014)
 *  - the returned id comes from the session, never from an argument
 */
