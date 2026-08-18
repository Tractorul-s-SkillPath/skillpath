/**
 * Tests for app/(student)/profile/actions.ts.
 *
 * Stories: SP-021, SP-022
 *
 * Cases
 *  - anonymous caller -> redirected/refused before any parse
 *  - the user id passed to the service comes from the session; a user_id field
 *    in the form is ignored entirely (§5)
 *  - an over-length objective -> field error, no write (SP-022)
 *  - success revalidates both /profile and the layout, so the header name
 *    updates (SP-021 AC1)
 */
