/**
 * assertAuth() — the first line of every protected page and Server Action.
 *
 * Story: SP-012
 *
 * Returns the current user or redirects to /login. A Server Action is a public
 * HTTP endpoint: middleware protecting the page it lives on protects nothing
 * about the action itself.
 *
 * Test: tests/lib/auth/assertAuth.test.ts
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from './current-user';

export async function assertAuth(): Promise<CurrentUser> {
    const user = await getCurrentUser();

    if (!user) {
        redirect('/login');
    }

    // A disabled account keeps a valid cookie until it expires (SP-014).
    if (user.status !== 'active') {
        redirect('/login?error=disabled');
    }

    return user;
}
