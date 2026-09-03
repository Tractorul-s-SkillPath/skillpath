/**
 * Login action.
 *
 * Layer: ACTION. Stories: SP-010, SP-014
 *
 * A wrapper around `loginAction` in the auth slice, with one piece of real
 * logic: it catches errors, and must NOT catch the redirect. `isRedirectError`
 * is the whole point of the try/catch — signing in succeeds by throwing
 * NEXT_REDIRECT, so a bare `catch` would turn every successful sign-in into a
 * silent no-op that leaves the member staring at the form.
 *
 * Note while reading the source's header: it says sign-in is passwordless. That
 * is no longer true — see tests/lib/auth/current-user.test.ts, which signs in
 * with a real scrypt-verified password. The comment is stale, the code is not.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAction } from '../../../../app/(auth)/login/actions';
import * as currentUser from '../../../../lib/auth/current-user';

vi.mock('../../../../lib/auth/current-user');

/** What Next's redirect() actually throws. */
const redirectError = () =>
    Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/dashboard;307;' });

beforeEach(() => vi.clearAllMocks());

describe('loginAction', () => {
    it('hands the whole FormData to the auth slice', async () => {
        vi.mocked(currentUser.loginAction).mockResolvedValue(undefined);

        const form = new FormData();
        form.set('email', 'member@skillpath.test');
        form.set('password', 'a password');

        await loginAction(form);

        expect(currentUser.loginAction).toHaveBeenCalledWith(form);
    });

    it('RETHROWS the redirect — this is how a successful sign-in finishes', async () => {
        vi.mocked(currentUser.loginAction).mockRejectedValue(redirectError());

        await expect(loginAction(new FormData())).rejects.toThrow('NEXT_REDIRECT');
    });

    it('rethrows the redirect for a FAILED sign-in too', async () => {
        // /login?error=invalid is also a redirect. Swallowing it would leave
        // the form with no error message and no navigation — the member clicks
        // Sign in and nothing at all happens.
        vi.mocked(currentUser.loginAction).mockRejectedValue(
            Object.assign(new Error('NEXT_REDIRECT'), {
                digest: 'NEXT_REDIRECT;replace;/login?error=invalid;307;',
            }),
        );

        await expect(loginAction(new FormData())).rejects.toThrow('NEXT_REDIRECT');
    });

    it('swallows a non-redirect error and returns normally', async () => {
        // Deliberate: the form re-renders rather than showing a crash page.
        // Pinned because it is also the reason a genuine outage is invisible
        // here — the member sees the login form again with nothing said.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.mocked(currentUser.loginAction).mockRejectedValue(new Error('database down'));

        await expect(loginAction(new FormData())).resolves.toBeUndefined();
        expect(spy).toHaveBeenCalled();

        spy.mockRestore();
    });
});
