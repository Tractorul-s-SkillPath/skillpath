/**
 * Login server action.
 *
 * Layer: ACTION — the thin edge between the form and the auth slice (§3).
 * Stories: SP-010, SP-014
 *
 * This used to parse the form and then redirect('/dashboard') without creating
 * a session. Middleware saw no cookie on /dashboard and sent the browser
 * straight back to /login, so signing in was an infinite bounce. The real
 * implementation — look the account up, create the signed session, redirect by
 * the role stored in the database — has always been in lib/auth/current-user.ts;
 * this file exists so the page keeps importing an action from its own slice.
 *
 * Read the header of lib/auth/current-user.ts before trusting this with
 * anything: sign-in is passwordless by team decision. The password field on the
 * form is collected and never verified.
 *
 * Not handled: middleware appends ?next= when it bounces you off a protected
 * page, and this ignores it — you land on your role's home instead of where you
 * were headed. That needs a hidden field on the form and a next-aware redirect.
 *
 * Test: tests/app/(auth)/login/actions.test.ts
 */
'use server';

import { loginAction as signIn } from '../../../lib/auth/current-user';

export async function loginAction(formData: FormData): Promise<void> {
    // signIn always ends in a redirect(), which throws NEXT_REDIRECT. Awaiting
    // lets that propagate — catching it here would swallow the navigation.
    await signIn(formData);
}
