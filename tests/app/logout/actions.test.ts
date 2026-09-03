/**
 * Logout action.
 *
 * Layer: ACTION. Story: SP-010
 *
 * Twenty lines of source and exactly one thing that can go wrong: the wrapper
 * must AWAIT and not catch. `signOut` ends in `redirect()`, which works by
 * throwing NEXT_REDIRECT — so a try/catch here would swallow the navigation and
 * leave the member on the page they just signed out of, still rendering their
 * name.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutAction } from '../../../app/logout/actions';
import * as currentUser from '../../../lib/auth/current-user';

vi.mock('../../../lib/auth/current-user');

beforeEach(() => vi.clearAllMocks());

describe('logoutAction', () => {
    it('delegates to the auth slice', async () => {
        vi.mocked(currentUser.logoutAction).mockResolvedValue(undefined);

        await logoutAction();

        expect(currentUser.logoutAction).toHaveBeenCalledOnce();
    });

    it('lets the redirect escape instead of swallowing it', async () => {
        // The one bug this file can have. redirect() signals by throwing; a
        // wrapper that catches turns "sign out and go home" into "sign out and
        // stay here", with a stale signed-in shell on screen.
        const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
            digest: 'NEXT_REDIRECT;replace;/;307;',
        });

        vi.mocked(currentUser.logoutAction).mockRejectedValue(redirectError);

        await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
    });

    it('does not hide a real failure either', async () => {
        vi.mocked(currentUser.logoutAction).mockRejectedValue(new Error('cookie jar unavailable'));

        await expect(logoutAction()).rejects.toThrow('cookie jar unavailable');
    });
});
