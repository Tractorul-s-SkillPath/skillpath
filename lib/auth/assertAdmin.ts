/**
 * assertAdmin() — the service-layer half of authorization.
 *
 * Story: SP-030
 *
 * ARCHITECTURE §5c: RLS covers user-owned rows, but the question bank runs
 * through the service-role client (because `answers` is unreachable over the
 * API), and the service-role client answers to nobody. This is the check that
 * gates it.
 *
 * Test: tests/lib/auth/assertAdmin.test.ts
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { assertAuth } from './assertAuth';
import type { CurrentUser } from './current-user';

export async function assertAdmin(): Promise<CurrentUser> {
    const user = await assertAuth();

    if (user.role !== 'admin') {
        redirect('/dashboard');
    }

    return user;
}
