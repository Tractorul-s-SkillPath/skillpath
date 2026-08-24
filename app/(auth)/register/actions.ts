/**
 * Registration server action.
 *
 * Layer: ACTION
 * Story: SP-011
 *
 * There is no separate sign-up path: loginAction creates the account when the
 * email has never been seen, so registering and signing in are the same call
 * with different fields posted. This wrapper exists so the register page
 * imports a verb that matches what the user thinks they are doing, and so the
 * two can diverge later without touching the page.
 *
 * What it inherits from that action, and what the team has agreed to:
 *  - no password is verified. The field is collected and dropped (see the
 *    header of lib/auth/current-user.ts)
 *  - registering with an email that already exists signs you into that account
 *    rather than failing. There is no credential, so there is nothing to get
 *    wrong — but it does mean "email already taken" is not a state that exists
 *  - the role dropdown is honoured only when the account is created; after
 *    that role comes from the database and the dropdown does nothing
 *
 * Test: tests/app/(auth)/register/actions.test.ts
 */
'use server';

import { loginAction } from '../../../lib/auth/current-user';

export async function registerAction(formData: FormData): Promise<void> {
    // Ends in a redirect(), which throws NEXT_REDIRECT — let it through.
    await loginAction(formData);
}
