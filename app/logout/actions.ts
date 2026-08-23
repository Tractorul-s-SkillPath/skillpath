/**
 * Logout server action.
 *
 * Layer: ACTION
 * Story: SP-010
 *
 * A real action file now: 'use server', one exported async function, no React
 * in sight. What used to be at this path was a page component in a file named
 * `actions.ts`, which meant neither the page nor the action existed.
 *
 * The work itself is in lib/auth/current-user.ts — destroy the session,
 * revalidate the layout so no signed-in RSC payload survives in the client
 * router cache (SP-010 AC3), redirect to /login.
 *
 * Test: tests/app/logout/actions.test.ts — asserts the Back-button case.
 */

'use server';

import { logoutAction as signOut } from '../../lib/auth/current-user';

export async function logoutAction(): Promise<void> {
    // signOut ends in redirect(), which throws NEXT_REDIRECT. Awaiting lets it
    // propagate — catching it here would swallow the navigation.
    await signOut();
}
