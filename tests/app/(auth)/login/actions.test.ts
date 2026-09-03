/**
 * Login action.
 *
 * Layer: ACTION. Stories: SP-010, SP-012, SP-014
 *
 * ---------------------------------------------------------------------------
 * THIS FILE USED TO TEST A WRAPPER. THERE IS NO WRAPPER ANY MORE.
 * ---------------------------------------------------------------------------
 *
 * `app/(auth)/login/actions.ts` used to forward its FormData to `loginAction`
 * in the auth slice and exist mainly to catch errors without catching the
 * redirect. The auth slice no longer signs anybody in — Supabase Auth does —
 * so the action does the work itself and the try/catch is gone with the thing
 * it was guarding.
 *
 * What replaced those four tests is the set of decisions the action actually
 * makes: which error code the member is sent back with, whether a disabled
 * account is signed out again, and where each role lands.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `redirect()` finishes this action on every path, success included, by
 * throwing. Rethrowing a labelled error keeps that shape while letting a test
 * read the destination — asserting on a NEXT_REDIRECT digest string would be
 * asserting on a Next implementation detail.
 */
class Redirect extends Error {
    constructor(readonly to: string) {
        super(`redirect:${to}`);
    }
}

vi.mock('next/navigation', () => ({
    redirect: (to: string) => {
        throw new Redirect(to);
    },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Swapped per test: what signInWithPassword and the profile read return. */
let signInResult: { data: { user: { id: string } | null }; error: unknown };
let profileResult: { data: { role: string; status: string } | null };

const signOut = vi.fn();

vi.mock('../../../../lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            signInWithPassword: async () => signInResult,
            signOut,
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => profileResult,
                }),
            }),
        }),
    }),
}));

const { loginAction } = await import('../../../../app/(auth)/login/actions');

/** Runs the action and reports where it sent the browser. */
async function landsOn(form: FormData): Promise<string> {
    try {
        await loginAction(form);
    } catch (error) {
        if (error instanceof Redirect) return error.to;
        throw error;
    }

    throw new Error('the action returned without redirecting, which it must never do');
}

function credentials(extra: Record<string, string> = {}): FormData {
    const form = new FormData();
    form.set('email', 'member@skillpath.test');
    form.set('password', 'a-real-password');
    Object.entries(extra).forEach(([key, value]) => form.set(key, value));
    return form;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    signInResult = { data: { user: { id: 'user-uuid' } }, error: null };
    profileResult = { data: { role: 'student', status: 'active' } };
});

describe('a successful sign-in', () => {
    it('sends a student to /dashboard', async () => {
        expect(await landsOn(credentials())).toBe('/dashboard');
    });

    it('sends an admin to /admin', async () => {
        // Read from public.users, never from the form or the token: a demoted
        // admin's JWT stays valid until it expires, so the row is the authority.
        profileResult = { data: { role: 'admin', status: 'active' } };

        expect(await landsOn(credentials())).toBe('/admin');
    });

    it('honours `next` ahead of the role default', async () => {
        expect(await landsOn(credentials({ next: '/assessments/3' }))).toBe('/assessments/3');
    });
});

describe('`next` is attacker-controlled', () => {
    it.each([
        ['an absolute url', 'https://elsewhere.example/steal'],
        ['a protocol-relative url', '//elsewhere.example/steal'],
        ['a backslash escape', '/\\elsewhere.example'],
    ])('ignores %s and uses the role default', async (_label, next) => {
        // Without safeNext() this action is an open redirect wearing our
        // domain: /login?next=… is a link anybody can send.
        expect(await landsOn(credentials({ next }))).toBe('/dashboard');
    });
});

describe('a failed sign-in', () => {
    it('reports `invalid` for bad credentials', async () => {
        signInResult = { data: { user: null }, error: { message: 'Invalid login credentials' } };

        expect(await landsOn(credentials())).toBe('/login?error=invalid');
    });

    it('reports `invalid` for an unknown address too, not `not_found`', async () => {
        // One message for both, deliberately. Telling them apart turns the form
        // into an oracle for which addresses have accounts.
        signInResult = { data: { user: null }, error: { message: 'Invalid login credentials' } };

        expect(await landsOn(credentials({ email: 'nobody@skillpath.test' }))).toBe(
            '/login?error=invalid',
        );
    });

    it('refuses an empty form without calling Supabase', async () => {
        const form = new FormData();
        form.set('email', '');
        form.set('password', '');

        expect(await landsOn(form)).toBe('/login?error=invalid');
    });
});

describe('an account that is disabled', () => {
    beforeEach(() => {
        profileResult = { data: { role: 'student', status: 'inactive' } };
    });

    it('is sent to /login?error=disabled', async () => {
        expect(await landsOn(credentials())).toBe('/login?error=disabled');
    });

    it('is SIGNED OUT again, not merely redirected', async () => {
        // The credentials were correct, so Supabase has already issued a
        // session and set its cookies. Without this the member is refused at
        // /login and then walks straight into /dashboard by typing the URL —
        // the redirect is not the boundary, the missing session is.
        await landsOn(credentials());

        expect(signOut).toHaveBeenCalled();
    });
});

describe('an account with no profile row', () => {
    it('is signed out and reported as unavailable', async () => {
        // auth.users has the account but on_auth_user_created never wrote the
        // profile. Nothing downstream can read a role, so letting the session
        // stand would produce a signed-in member every page bounces.
        profileResult = { data: null };

        expect(await landsOn(credentials())).toBe('/login?error=unavailable');
        expect(signOut).toHaveBeenCalled();
    });
});
