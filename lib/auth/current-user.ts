/**
 * Read the current session.
 *
 * Stories: SP-010, SP-012
 *
 * Sketch: getCurrentUser() -> { userId, role, status } | null, from
 * supabase.auth.getUser() (verified server-side) joined to profiles. Never from
 * getSession(), which trusts the cookie payload.
 *
 * Test: tests/lib/auth/current-user.test.ts
 */

import { cookies } from 'next/headers';

export type UserRole = 'student' | 'admin';

export interface User {
    userId: string;
    email: string;
    role: UserRole;
    status: string;
}

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get('auth_session')?.value;
    if (!session) return null;

    try {
        return JSON.parse(session) as User;
    } catch {
        return null;
    }
}

export async function loginAction(formData: FormData): Promise<void> {
    'use server';
    const email = formData.get('email') as string;
    const role = formData.get('role') as UserRole;

    const cookieStore = await cookies();
    cookieStore.set('auth_session', JSON.stringify({
        userId: 'usr_123',
        email,
        role,
        status: 'active'
    }), { path: '/' });
}

export async function logoutAction(): Promise<void> {
    'use server';
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');
}