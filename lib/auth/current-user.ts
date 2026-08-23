/**
 * Session + sign in / sign out.
 *
 * Stories: SP-010, SP-011, SP-012
 *
 * ---------------------------------------------------------------------------
 * PASSWORDLESS BY TEAM DECISION — READ BEFORE THIS SHIPS ANYWHERE REAL
 *
 * Signing in requires only an email address. No password is asked for and none
 * is verified, because the existing login form (app/(auth)/login, owned by the
 * auth slice) posts email + a role dropdown and the team chose to keep that
 * form as it is.
 *
 * The consequence, stated plainly and once: anybody can sign in as anybody by
 * typing their email address. There is no credential. Treat every account as
 * public until a password field exists on that form. Adding one means hashing
 * and verifying properly — none of that code exists here, deliberately, because
 * nothing calls it.
 *
 * What IS protected: the session cookie is HMAC-signed (lib/auth/session.ts),
 * so a signed-in member cannot edit their own cookie to become an
 * administrator. Role is read from the users table on every request, never
 * taken from the cookie or from the form's role dropdown.
 * ---------------------------------------------------------------------------
 *
 * Test: tests/lib/auth/current-user.test.ts
 */

import 'server-only';
import { cache } from 'react';
import { randomBytes } from 'node:crypto';
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
    /**
     * The member's row, minus `password`.
     *
     * This used to be the whole row from a `select('*')`, which meant the
     * password column travelled into every layout and header that asked who was
     * signed in. Nothing read it — but it was one `'use client'` away from
     * being serialised to the browser. Asking for named columns removes the
     * question entirely.
     */
    user: UserPublicRow;
}

/**
 * `cache` dedupes this per request: the layout and every section can each ask
 * who the user is and the database is queried once.
 */
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

    // A cookie for a user that no longer exists: treat as signed out.
    if (!user) return null;

    return {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
        user,
    };
});

// ---------------------------------------------------------------------------
// Actions used by app/(auth)/login and app/(auth)/register.
//
// Those two pages import these names and are left exactly as they are, so the
// signature stays `(formData) => Promise<void>` and the field names stay
// whatever those forms already post: `email` and `role` from login, `name` and
// `email` from register.
//
// The proper home is app/(auth)/*/actions.ts, following the layer rule (§3).
// Move them when the auth slice is written for real.
// ---------------------------------------------------------------------------

/** "Ana Maria Popescu" -> first "Ana Maria", last "Popescu". */
function splitName(full: string): { firstName: string; lastName: string } {
    const parts = full.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };

    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * The name, from whichever shape the form posted.
 *
 * Register posts firstName + lastName as two fields. A single `name` field is
 * still accepted and split, because that is what this action was written
 * against and no form should have to change to keep working.
 */
function nameFrom(formData: FormData): { firstName: string; lastName: string } {
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();

    if (firstName || lastName) return { firstName, lastName };

    return splitName(String(formData.get('name') ?? '').trim());
}

/**
 * Where to land after signing in.
 *
 * Middleware appends `?next=` when it bounces somebody off a protected page,
 * and the login form carries it through as a hidden field. Nothing read it
 * before, so being kicked off /plan and signing back in landed you on
 * /dashboard.
 *
 * Only a path on this site is accepted. A value starting `//` or carrying a
 * scheme would make the login form an open redirect — somewhere to send a
 * member after they have just proved they trust the page they are on.
 */
function safeNext(formData: FormData): string | null {
    const next = String(formData.get('next') ?? '').trim();

    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    if (next.includes('\\')) return null;

    return next;
}

/**
 * Sign in, and create the account if this email has never been seen.
 *
 * Both forms post here — login sends email + role, register sends name +
 * email — so one action serves both and neither page has to change.
 */
export async function loginAction(formData: FormData): Promise<void> {
    'use server';

    const email = String(formData.get('email') ?? '')
        .trim()
        .toLowerCase();

    if (!email) {
        redirect('/login?error=invalid');
    }

    const requestedRole = String(formData.get('role') ?? '') === 'admin' ? 'admin' : 'student';

    const supabase = await createClient();

    const { data: existing, error } = await supabase
        .from('users')
        .select(USER_PUBLIC_COLUMNS)
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('[auth] lookup failed:', error.message);
        redirect('/login?error=unavailable');
    }

    let user = existing;

    if (!user) {
        let { firstName, lastName } = nameFrom(formData);

        // Login posts no name at all, so a first sign-in from that form has to
        // derive something rather than store two empty strings.
        if (!firstName && !lastName) {
            ({ firstName, lastName } = splitName(email.split('@')[0]));
        }

        // The column is NOT NULL and nothing ever reads it. Random bytes
        // rather than a fixed placeholder, so it cannot be mistaken for a real
        // hash and cannot match anything if a password check is added later.
        const unusable = randomBytes(32).toString('hex');

        const { data: created, error: insertError } = await supabase
            .from('users')
            .insert({
                first_name: firstName,
                last_name: lastName,
                email,
                password: unusable,
                role: requestedRole,
                status: 'active',
            })
            .select(USER_PUBLIC_COLUMNS)
            .single();

        if (insertError || !created) {
            console.error('[auth] could not create account:', insertError?.message);
            redirect('/login?error=unavailable');
        }

        user = created;

        // Register lets the member tick the categories they care about. A
        // category_progress row IS the interest in this schema (see
        // profile.repo.ts), so signing up with three ticked is the same write
        // the profile page makes later — insert only, because a brand-new
        // account has nothing to remove.
        const chosen = [
            ...new Set(
                formData
                    .getAll('skills')
                    .map((value) => Number(value))
                    .filter((id) => Number.isInteger(id) && id > 0),
            ),
        ];

        if (chosen.length > 0) {
            const { error: interestError } = await supabase.from('category_progress').insert(
                chosen.map((category_id) => ({
                    user_id: created.user_id,
                    category_id,
                    current_level: 'beginner' as const,
                })),
            );

            // Not fatal. The account exists and the profile page can set these
            // — losing the signup ticks is not worth losing the registration.
            if (interestError) {
                console.error('[auth] could not save interests:', interestError.message);
            }
        }
    }

    // Role comes from the database, never from the form. Otherwise the role
    // dropdown would be a one-click promotion to administrator.
    if (user.status !== 'active') {
        redirect('/login?error=disabled');
    }

    await createSession(user.user_id);
    revalidatePath('/', 'layout');

    redirect(safeNext(formData) ?? (user.role === 'admin' ? '/admin' : '/dashboard'));
}

export async function logoutAction(): Promise<void> {
    'use server';

    await destroySession();

    // Without this the router cache can still render the signed-in header
    // after the redirect (SP-010 AC3).
    revalidatePath('/', 'layout');
    redirect('/login');
}
