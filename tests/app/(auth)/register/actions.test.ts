/**
 * Register action.
 *
 * Layer: ACTION. Story: SP-011
 *
 * ---------------------------------------------------------------------------
 * THE POINT OF THIS FILE IS THAT EACH FAILURE KEEPS ITS OWN NAME.
 * ---------------------------------------------------------------------------
 *
 * Registration used to funnel every possible error into one redirect:
 *
 *     if (error) redirect('/register?error=email_already_exists');
 *
 * The E2E journey registers a freshly minted address every run, so that
 * message was impossible by construction — and it was what the page showed for
 * two days while the real error was `429 email rate limit exceeded`. A masked
 * error does not just hide a cause, it argues for the wrong fix.
 *
 * So the rate-limit case below is not a nice-to-have: it is the regression
 * test for the bug that cost the diagnosis. If somebody collapses these
 * branches back into one, it goes red.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/** Swapped per test: what signUp returns. */
let signUpResult: {
    data: { user: { id: string; identities?: unknown[] } | null; session: unknown };
    error: { status?: number; code?: string; message: string } | null;
};

const insert = vi.fn(async () => ({ error: null }));
const signOut = vi.fn(async () => ({ error: null }));

vi.mock('../../../../lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { signUp: async () => signUpResult, signOut },
        from: () => ({ insert }),
    }),
}));

const { registerAction } = await import('../../../../app/(auth)/register/actions');

async function landsOn(form: FormData): Promise<string> {
    try {
        await registerAction(form);
    } catch (error) {
        if (error instanceof Redirect) return error.to;
        throw error;
    }

    throw new Error('the action returned without redirecting, which it must never do');
}

function signup(extra: Record<string, string> = {}): FormData {
    const form = new FormData();
    form.set('email', 'new@skillpath.test');
    form.set('password', 'a-real-password');
    form.set('firstName', 'New');
    form.set('lastName', 'Member');
    Object.entries(extra).forEach(([key, value]) => form.set(key, value));
    return form;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    signUpResult = {
        data: { user: { id: 'user-uuid', identities: [{}] }, session: { access_token: 't' } },
        error: null,
    };
});

describe('a successful sign-up', () => {
    it('lands on /success', async () => {
        expect(await landsOn(signup())).toBe('/success');
    });

    it('ends SIGNED OUT, whatever signUp handed back', async () => {
        // With email confirmation off, signUp returns a live session. /success
        // is in the (auth) group, whose layout redirects anyone signed in to
        // their role's home — so without this the member never sees "account
        // created, now sign in", they land on /dashboard. Both E2E specs failed
        // on exactly that.
        //
        // It also keeps the sign-in step of those journeys meaningful: an
        // already-authenticated member sails through /login on the layout's
        // redirect and the assertion passes without sign-in happening.
        await landsOn(signup());

        expect(signOut).toHaveBeenCalled();
    });

    it('saves the categories the member chose', async () => {
        const form = signup();
        form.append('skills', '3');
        form.append('skills', '5');

        await landsOn(form);

        expect(insert).toHaveBeenCalledWith([
            { user_id: 'user-uuid', category_id: 3, current_level: 'beginner' },
            { user_id: 'user-uuid', category_id: 5, current_level: 'beginner' },
        ]);
    });

    it('still lands on /success when saving those categories fails', async () => {
        // The account exists by this point. Failing the registration over a
        // preference would strand a member with credentials nobody told them
        // worked.
        insert.mockResolvedValueOnce({ error: { message: 'nope' } as never });

        const form = signup();
        form.append('skills', '3');

        expect(await landsOn(form)).toBe('/success');
    });

    it('does not try to save categories when there is no session yet', async () => {
        // With email confirmation ON, signUp returns no session, RLS sees a
        // null auth.uid() and would reject the insert.
        signUpResult.data.session = null;

        const form = signup();
        form.append('skills', '3');

        await landsOn(form);

        expect(insert).not.toHaveBeenCalled();
    });
});

describe('each failure keeps its own name', () => {
    it('reports a rate limit as `rate_limited`, NOT as a duplicate email', async () => {
        // The regression test for the two-day misdiagnosis. Supabase's built-in
        // SMTP allows about two confirmation mails an hour and the E2E suite
        // asks for more, so this is the error the suite actually hits.
        signUpResult = {
            data: { user: null, session: null },
            error: { status: 429, message: 'email rate limit exceeded' },
        };

        expect(await landsOn(signup())).toBe('/register?error=rate_limited');
    });

    it('reports a genuine duplicate as `email_already_exists`', async () => {
        signUpResult = {
            data: { user: null, session: null },
            error: { code: 'user_already_exists', message: 'User already registered' },
        };

        expect(await landsOn(signup())).toBe('/register?error=email_already_exists');
    });

    it('reports a duplicate that Supabase disguises, too', async () => {
        // With confirmation on, a repeat address is NOT an error: Supabase
        // returns a user with no identities so the form cannot be used to
        // enumerate accounts. Reporting success here would tell the E2E suite
        // an account was created when none was.
        signUpResult = {
            data: { user: { id: 'user-uuid', identities: [] }, session: null },
            error: null,
        };

        expect(await landsOn(signup())).toBe('/register?error=email_already_exists');
    });

    it('reports a weak password as `password_too_short`', async () => {
        signUpResult = {
            data: { user: null, session: null },
            error: { code: 'weak_password', message: 'Password is too weak' },
        };

        expect(await landsOn(signup())).toBe('/register?error=password_too_short');
    });

    it('reports anything unrecognised as `unavailable` rather than guessing', async () => {
        signUpResult = {
            data: { user: null, session: null },
            error: { status: 500, message: 'upstream exploded' },
        };

        expect(await landsOn(signup())).toBe('/register?error=unavailable');
    });

    it('rejects a short password before calling Supabase at all', async () => {
        expect(await landsOn(signup({ password: 'short' }))).toBe(
            '/register?error=password_too_short',
        );
    });

    it('rejects an empty form', async () => {
        expect(await landsOn(signup({ email: '', password: '' }))).toBe(
            '/register?error=missing_fields',
        );
    });
});

describe('role', () => {
    it('is never taken from the form', async () => {
        // `on_auth_user_created` hardcodes 'student'. The old code enforced
        // this in TypeScript with a managerApproval field; the trigger enforces
        // it where a crafted POST cannot argue. Nothing here should forward it.
        await landsOn(signup({ role: 'admin' }));

        expect(insert).not.toHaveBeenCalled();
    });
});
