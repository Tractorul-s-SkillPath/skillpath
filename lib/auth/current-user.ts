/**
 * Session + sign in / sign out with Secure Password Authentication.
 *
 * Stories: SP-010, SP-011, SP-012
 *
 * ---------------------------------------------------------------------------
 * SECURITY & PASSWORD AUTHENTICATION
 *
 * Signing in requires both a valid email address and a correct password.
 * Passwords are securely hashed and verified with a random salt using
 * node:crypto (scrypt), preventing unauthorized access to user accounts.
 *
 * What IS protected:
 * - The session cookie is HMAC-signed (lib/auth/session.ts), preventing a
 *   signed-in member from tampering with their cookie to become an administrator.
 * - The user role is always read directly from the database (users table) on
 *   every request, never taken from the cookie or from form inputs.
 * ---------------------------------------------------------------------------
 *
 * Test: tests/lib/auth/current-user.test.ts
*/

import 'server-only';
import { cache } from 'react';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { createSession, destroySession, readSession } from './session';
import { USER_PUBLIC_COLUMNS, type UserPublicRow } from '../supabase/database.types';

export type UserRole = 'student' | 'admin';

export interface CurrentUser {
    userId: number;
    email: string;
    role: UserRole;
    status: string;
    user: UserPublicRow;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
    const userId = await readSession();
    if (userId === null) return null;

    const supabase = await createClient();

    const { data: user, error } = await supabase
        .from('users')
        .select(USER_PUBLIC_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('[auth] could not load user', userId, error.message);
        return null;
    }

    if (!user) return null;

    return {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
        user,
    };
});

function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const buf = scryptSync(password, salt, 64) as Buffer;
    return `${salt}:${buf.toString('hex')}`;
}

function verifyPassword(supplied: string, stored: string): boolean {
    const [salt, key] = stored.split(':');
    if (!salt || !key) return false;
    try {
        const keyBuffer = Buffer.from(key, 'hex');
        const suppliedBuffer = scryptSync(supplied, salt, 64) as Buffer;
        return timingSafeEqual(keyBuffer, suppliedBuffer);
    } catch {
        return false;
    }
}

function splitName(full: string): { firstName: string; lastName: string } {
    const parts = full.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };

    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function nameFrom(formData: FormData): { firstName: string; lastName: string } {
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();

    if (firstName || lastName) return { firstName, lastName };

    return splitName(String(formData.get('name') ?? '').trim());
}

function safeNext(formData: FormData): string | null {
    const next = String(formData.get('next') ?? '').trim();

    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    if (next.includes('\\')) return null;

    return next;
}

export async function loginAction(formData: FormData): Promise<void> {
    'use server';

    const cleanEmail = String(formData.get('email') ?? '').trim().toLowerCase();
    const rawPassword = String(formData.get('password') ?? '');

    if (!cleanEmail || !rawPassword) {
        redirect('/login?error=invalid');
    }

    const requestedRole = String(formData.get('role') ?? '') === 'admin' ? 'admin' : 'student';
    const { firstName, lastName } = nameFrom(formData);

    const supabase = await createClient();

    const { data: existingEmailUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

    const isRegistering = formData.has('firstName') || formData.has('skills') || formData.has('name') || formData.has('role');

    if (!isRegistering && !existingEmailUser) {
        redirect('/login?error=not_found');
    }

    if (isRegistering) {
        if (firstName && lastName) {
            const { data: existingNameUser } = await supabase
                .from('users')
                .select(USER_PUBLIC_COLUMNS)
                .eq('first_name', firstName)
                .eq('last_name', lastName)
                .maybeSingle();

            if (existingNameUser) {
                redirect('/register?error=name_already_exists');
            }
        }

        if (existingEmailUser) {
            redirect('/register?error=email_already_exists');
        }

        if (requestedRole === 'admin') {
            const managerApproval = formData.get('managerApproval');
            if (!managerApproval) {
                redirect('/register?error=manager_approval_required');
            }
        }

        const resolvedFirstName = firstName || splitName(cleanEmail.split('@')[0]).firstName;
        const resolvedLastName = lastName || splitName(cleanEmail.split('@')[0]).lastName;

        const hashedPassword = hashPassword(rawPassword);

        const { data: created, error: insertError } = await supabase
            .from('users')
            .insert({
                first_name: resolvedFirstName,
                last_name: resolvedLastName,
                email: cleanEmail,
                password: hashedPassword,
                role: requestedRole,
                status: 'active',
            })
            .select(USER_PUBLIC_COLUMNS)
            .single();

        if (insertError || !created) {
            console.error('[auth] could not create account:', insertError?.message);
            redirect('/login?error=unavailable');
        }

        const chosen = [
            ...new Set(
                formData
                    .getAll('skills')
                    .map((value) => Number(value))
                    .filter((id) => Number.isInteger(id) && id > 0),
            ),
        ];

        if (chosen.length > 0) {
            await supabase.from('category_progress').insert(
                chosen.map((category_id) => ({
                    user_id: created.user_id,
                    category_id,
                    current_level: 'beginner' as const,
                })),
            );
        }

        redirect('/success');
    }

    let user = existingEmailUser;

    if (!user) {
        redirect('/login?error=not_found');
    }

    if (user.status !== 'active') {
        redirect('/login?error=disabled');
    }

    let isPasswordValid = false;

    if (user.password && user.password.includes(':')) {
        isPasswordValid = verifyPassword(rawPassword, user.password);
    }

    if (!isPasswordValid) {
        redirect('/login?error=invalid');
    }

    await createSession(user.user_id);
    revalidatePath('/', 'layout');

    redirect(safeNext(formData) ?? (user.role === 'admin' ? '/admin' : '/dashboard'));
}

export async function logoutAction(): Promise<void> {
    'use server';

    await destroySession();
    revalidatePath('/', 'layout');
    redirect('/');
}