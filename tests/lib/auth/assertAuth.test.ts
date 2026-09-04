/**
 * Tests for lib/auth/assertAuth.ts.
 *
 * Story: SP-012
 *
 * A Server Action is a public HTTP endpoint. Middleware protecting the page an
 * action lives on protects nothing about the action itself, so this function is
 * the first line of every protected path in the product.
 *
 * `redirect()` from next/navigation never returns — it throws a control-flow
 * error that Next catches. The mock below throws too, and it has to: with a
 * mock that returns normally, assertAuth would carry on and read `.status` off
 * a null user, and a test suite built on that would be testing a function that
 * cannot exist in production.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/current-user';
import { assertAuth } from '../../../lib/auth/assertAuth';
import { aCurrentUser } from '../../helpers/builders';

vi.mock('../../../lib/auth/current-user');
vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT ${url}`);
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('assertAuth', () => {
    it('returns the signed-in member', async () => {
        const user = aCurrentUser();
        vi.mocked(getCurrentUser).mockResolvedValue(user);

        await expect(assertAuth()).resolves.toBe(user);
        expect(redirect).not.toHaveBeenCalled();
    });

    it('sends an unauthenticated visitor to the login page', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);

        await expect(assertAuth()).rejects.toThrow('NEXT_REDIRECT /login');
        expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('locks out a deactivated account that still holds a valid cookie (SP-014)', async () => {
        // Deactivation does not invalidate the session cookie, so the status
        // check here is what actually enforces it — until the cookie expires,
        // this is the only thing between a disabled member and every page.
        vi.mocked(getCurrentUser).mockResolvedValue(aCurrentUser({ status: 'inactive' }));

        await expect(assertAuth()).rejects.toThrow('NEXT_REDIRECT /login?error=disabled');
        expect(redirect).toHaveBeenCalledWith('/login?error=disabled');
    });

    it('distinguishes a disabled account from a signed-out one', async () => {
        // Different destinations because the login page tells them different
        // things. Collapsing the two would leave a disabled member retyping a
        // password that will never work.
        vi.mocked(getCurrentUser).mockResolvedValue(aCurrentUser({ status: 'inactive' }));
        await expect(assertAuth()).rejects.toThrow();

        vi.mocked(getCurrentUser).mockResolvedValue(null);
        await expect(assertAuth()).rejects.toThrow();

        expect(vi.mocked(redirect).mock.calls).toEqual([['/login?error=disabled'], ['/login']]);
    });

    it('rejects any status that is not exactly active', async () => {
        // The column is a string, so an unrecognised value must fail closed.
        vi.mocked(getCurrentUser).mockResolvedValue(aCurrentUser({ status: 'pending' }));

        await expect(assertAuth()).rejects.toThrow('NEXT_REDIRECT /login?error=disabled');
    });
});
