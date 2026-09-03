/**
 * Register action.
 *
 * Layer: ACTION. Story: SP-011
 *
 * There is no separate sign-up path: `loginAction` creates the account when the
 * email has never been seen, so registering and signing in are the same call
 * with different fields posted. This wrapper exists so the page imports a verb
 * matching what the member thinks they are doing.
 *
 * Unlike the login wrapper it has no try/catch, so the only thing to assert is
 * that it passes the form through and lets the redirect out.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAction } from '../../../../app/(auth)/register/actions';
import * as currentUser from '../../../../lib/auth/current-user';

vi.mock('../../../../lib/auth/current-user');

beforeEach(() => vi.clearAllMocks());

describe('registerAction', () => {
    it('posts the form to the same action sign-in uses', async () => {
        vi.mocked(currentUser.loginAction).mockResolvedValue(undefined);

        const form = new FormData();
        form.set('email', 'new@skillpath.test');
        form.set('firstName', 'New');
        form.append('skills', '3');

        await registerAction(form);

        // The WHOLE form, not a rebuilt subset: `skills` and `managerApproval`
        // are read inside loginAction, and a wrapper that picked fields by hand
        // would silently drop the interests a member chose at signup.
        expect(currentUser.loginAction).toHaveBeenCalledWith(form);
    });

    it('lets the redirect through', async () => {
        vi.mocked(currentUser.loginAction).mockRejectedValue(
            Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/success;307;' }),
        );

        await expect(registerAction(new FormData())).rejects.toThrow('NEXT_REDIRECT');
    });
});
