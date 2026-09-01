/**
 * Tests for lib/auth/assertAdmin.ts.
 *
 * Story: SP-030
 *
 * ARCHITECTURE §5c: RLS covers user-owned rows, but the question bank runs
 * through the service-role client — `answers.is_correct` is unreachable over
 * the API — and the service-role client answers to nobody. This check is the
 * gate on that path.
 *
 * assertAuth is deliberately NOT mocked here. The chain is the thing worth
 * testing: an unauthenticated visitor must be stopped by the auth guard before
 * the role check ever looks at `user.role`, and mocking the inner guard would
 * hide a version that had them the wrong way round.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth/current-user';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import { aCurrentUser, anAdmin } from '../../helpers/builders';

vi.mock('../../../lib/auth/current-user');
vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT ${url}`);
    }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('assertAdmin', () => {
    it('returns the signed-in administrator', async () => {
        const admin = anAdmin();
        vi.mocked(getCurrentUser).mockResolvedValue(admin);

        await expect(assertAdmin()).resolves.toBe(admin);
        expect(redirect).not.toHaveBeenCalled();
    });

    it('sends a signed-in student to their own dashboard, not to login', async () => {
        // They are authenticated; the answer is "not for you", and bouncing
        // them to /login would just loop them back to a page they can reach.
        vi.mocked(getCurrentUser).mockResolvedValue(aCurrentUser({ role: 'student' }));

        await expect(assertAdmin()).rejects.toThrow('NEXT_REDIRECT /dashboard');
        expect(redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('stops an unauthenticated visitor at the auth guard first', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);

        await expect(assertAdmin()).rejects.toThrow('NEXT_REDIRECT /login');
        expect(redirect).toHaveBeenCalledWith('/login');
        expect(redirect).not.toHaveBeenCalledWith('/dashboard');
    });

    it('refuses a deactivated administrator', async () => {
        // Losing the account has to outrank holding the role, or deactivating
        // an admin would leave them full access to /admin.
        vi.mocked(getCurrentUser).mockResolvedValue(anAdmin({ status: 'inactive' }));

        await expect(assertAdmin()).rejects.toThrow('NEXT_REDIRECT /login?error=disabled');
    });
});
