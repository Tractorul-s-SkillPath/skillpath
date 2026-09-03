/**
 * Who is signed in, and the actions that change that.
 *
 * Stories: SP-010, SP-011, SP-012
 *
 * ---------------------------------------------------------------------------
 * THIS FILE NO LONGER OWNS AUTHENTICATION. SUPABASE AUTH DOES.
 * ---------------------------------------------------------------------------
 *
 * It used to hold a scrypt hash/verify pair, an account-creation branch, and a
 * signed cookie of our own (lib/auth/session.ts). All three are gone:
 *
 *  - Passwords live in `auth.users` and are hashed by Supabase. `public.users`
 *    has no `password` column any more, so there is nothing here to compare.
 *  - The session is Supabase's, carried in its own cookies and refreshed by
 *    middleware. `skillpath_session` is not written or read anywhere.
 *  - Sign-in and sign-up are `app/(auth)/login|register/actions.ts`, calling
 *    `signInWithPassword` and `signUp` directly.
 *
 * What this file still owns is the *profile*: `auth.users` knows an id and an
 * email and nothing else this application cares about, so every request that
 * needs a name, a role or a status reads `public.users` — and getCurrentUser()
 * is the one place that join happens.
 *
 * THE ROLE IS STILL READ FROM THE DATABASE ON EVERY REQUEST, never from the
 * JWT. Supabase will happily put custom claims in the token, and a token stays
 * valid for its lifetime — so an admin demoted a minute ago would keep the
 * claim until it expired. `users.role` is the authority; assertAdmin() reads it
 * through here.
 *
 * Test: tests/lib/auth/current-user.test.ts
 */

'use server';

import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../supabase/server';
import { USER_PUBLIC_COLUMNS, type UserPublicRow } from '../supabase/database.types';

export type UserRole = 'student' | 'admin';

export interface CurrentUser {
    /** The `auth.users` UUID. A string now, not an identity integer. */
    userId: string;
    email: string;
    role: UserRole;
    status: string;
    user: UserPublicRow;
}

/**
 * The signed-in member, or null.
 *
 * `getUser()` and NOT `getSession()`. getSession() decodes whatever cookie the
 * request carried and believes it; getUser() sends the token to the auth server
 * and gets it verified. On a Server Component the difference is the whole
 * security property — a forged or expired token has to fail here, not render a
 * dashboard.
 *
 * Wrapped in React's `cache` so the several components that each ask "who is
 * this?" during one render share a single round trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
    const supabase = await createClient();

    const {
        data: { user: authUser },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) return null;

    // RLS ("Acces profil propriu") restricts this to the caller's own row, so
    // the .eq() is belt and braces rather than the boundary — which is the
    // point of the anon-key client: a mistake here returns nothing instead of
    // returning somebody else.
    const { data: user, error } = await supabase
        .from('users')
        .select(USER_PUBLIC_COLUMNS)
        .eq('user_id', authUser.id)
        .maybeSingle();

    if (error) {
        console.error('[auth] could not load profile', authUser.id, error.message);
        return null;
    }

    // An auth user with no profile row means `on_auth_user_created` did not
    // fire — a broken migration, not a signed-out visitor. Treating it as
    // signed out is the safe direction, but it is worth the log line: the
    // symptom otherwise is a member who can sign in and then bounces straight
    // back to /login with no explanation.
    if (!user) {
        console.error('[auth] no profile row for auth user', authUser.id);
        return null;
    }

    return {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
        user,
    };
});

export async function changePasswordAction(formData: FormData): Promise<void> {
    'use server';

    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (!currentPassword || !newPassword || !confirmPassword) {
        redirect('/settings/password?error=missing_fields');
    }

    if (newPassword.length < 8) {
        redirect('/settings/password?error=password_too_short');
    }

    if (newPassword !== confirmPassword) {
        redirect('/settings/password?error=passwords_dont_match');
    }

    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

    const supabase = await createClient();

    // Supabase's updateUser() does NOT ask for the current password — a live
    // session is enough for it. That is too weak here: it means a borrowed
    // laptop with an open tab can change the password and lock the owner out.
    // Re-authenticating first is the check, and it is why currentPassword is
    // required above rather than optional as it used to be for accounts that
    // had no hash yet.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
    });

    if (reauthError) {
        redirect('/settings/password?error=invalid_current');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
        console.error('[auth] could not update password:', error.message);
        redirect('/settings/password?error=unavailable');
    }

    redirect('/settings/password/success');
}

export async function logoutAction(): Promise<void> {
    'use server';

    const supabase = await createClient();

    // Clears the session cookies through the same `setAll` the client was built
    // with, so the browser is signed out as well as the server.
    await supabase.auth.signOut();

    revalidatePath('/', 'layout');
    redirect('/');
}

/**
 * Start a password reset — by EMAIL, not by setting the new password here.
 *
 * ---------------------------------------------------------------------------
 * THIS REPLACES AN ACCOUNT-TAKEOVER HOLE, AND THE UI CHANGED WITH IT.
 * ---------------------------------------------------------------------------
 *
 * The previous version took an email and a new password from an unauthenticated
 * form and ran:
 *
 *     update users set password = <hash> where email = <whatever was posted>
 *
 * with no token, no ownership check and no rate limit. Anyone who knew an
 * address — admin@skillpath.dev is in the seed — could set its password and
 * sign in as it. It is the reason app/reset-password/page.tsx now collects only
 * an address.
 *
 * The reply is deliberately identical whether or not the address exists.
 * Reporting "no such account" would turn this form into a membership oracle,
 * which is the same leak in a smaller box.
 */
export async function resetPasswordAction(
    formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    if (!email) {
        return { error: 'missing_email' };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    // Logged, not returned. A failure here is almost always the project's mail
    // quota rather than anything the visitor can act on.
    if (error) {
        console.error('[auth] could not send a reset mail:', error.message);
    }

    return { success: true };
}
