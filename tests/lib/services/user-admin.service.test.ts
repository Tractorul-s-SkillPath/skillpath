/**
 * Tests for lib/services/user-admin.service.ts.
 *
 * Stories: SP-083, SP-014
 *
 * One real rule lives here: an admin may not deactivate themselves. With a
 * single administrator — this project's normal state — doing so locks the last
 * person out of /admin, and the only way back is a SQL script run against the
 * database by hand. The service's docblock is explicit that the check belongs
 * at this layer rather than in the action, so this is where it is tested.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import * as userRepo from '../../../lib/repositories/user.repo';
import { PAGE_SIZE } from '../../../lib/validation/filters.schema';
import { FAKE_CLIENT } from '../../helpers/in-memory-repos';
import { aManagedUser, aPage, anAdmin, ADMIN_ID, MEMBER_ID } from '../../helpers/builders';
import { listUsers, setUserStatus } from '../../../lib/services/user-admin.service';

vi.mock('../../../lib/auth/assertAdmin');
vi.mock('../../../lib/repositories/user.repo');
vi.mock('../../../lib/supabase/server', () => ({
    // The admin services query through createServiceClient — service role, because
    // RLS has no admin policy and every write here would be refused with 42501.
    // Mocked alongside createClient so a service that is moved between the two
    // fails on its assertions rather than on an undefined import.
    createClient: vi.fn(async () => FAKE_CLIENT),
    createServiceClient: vi.fn(() => FAKE_CLIENT),
}));

const REDIRECTED = new Error('NEXT_REDIRECT /dashboard');

const noFilters = { search: '', role: undefined, status: undefined, page: 1 };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
    vi.mocked(userRepo.listPaged).mockResolvedValue({ ok: true, value: aPage([aManagedUser()]) });
    vi.mocked(userRepo.setStatus).mockResolvedValue({ ok: true, value: undefined });
});

describe('the admin guard', () => {
    it.each([
        ['listUsers', () => listUsers(noFilters as never)],
        ['setUserStatus', () => setUserStatus(MEMBER_ID, 'inactive')],
    ])('stops %s before it reaches the database', async (_name, call) => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(call()).rejects.toThrow(REDIRECTED);

        expect(userRepo.listPaged).not.toHaveBeenCalled();
        expect(userRepo.setStatus).not.toHaveBeenCalled();
    });
});

describe('listUsers', () => {
    it('fixes the page size here, so a URL cannot ask for ten thousand rows', async () => {
        await listUsers({ ...noFilters, pageSize: 10_000 } as never);

        expect(userRepo.listPaged).toHaveBeenCalledWith(
            FAKE_CLIENT,
            expect.objectContaining({ pageSize: PAGE_SIZE }),
        );
    });

    it('passes the validated filters through', async () => {
        await listUsers({ search: 'ion', role: 'student', status: 'active', page: 3 } as never);

        expect(userRepo.listPaged).toHaveBeenCalledWith(FAKE_CLIENT, {
            search: 'ion',
            role: 'student',
            status: 'active',
            page: 3,
            pageSize: PAGE_SIZE,
        });
    });
});

describe('setUserStatus', () => {
    it('deactivates another member', async () => {
        const result = await setUserStatus(MEMBER_ID, 'inactive');

        expect(result.ok).toBe(true);
        expect(userRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, MEMBER_ID, 'inactive');
    });

    it('refuses to let an admin deactivate their own account', async () => {
        const result = await setUserStatus(ADMIN_ID, 'inactive');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('forbidden');
        expect(userRepo.setStatus).not.toHaveBeenCalled();
    });

    it('still lets an admin reactivate their own account', async () => {
        // Only 'inactive' is the trap. Blocking every self-directed change
        // would be a wider rule than the one that was decided.
        const result = await setUserStatus(ADMIN_ID, 'active');

        expect(result.ok).toBe(true);
        expect(userRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, ADMIN_ID, 'active');
    });

    it('compares against the session identity, not a hardcoded admin id', async () => {
        vi.mocked(assertAdmin).mockResolvedValue(anAdmin({ userId: '00000000-0000-4000-8000-000000004242' }));

        const self = await setUserStatus('00000000-0000-4000-8000-000000004242', 'inactive');
        const other = await setUserStatus(ADMIN_ID, 'inactive');

        expect(self.ok).toBe(false);
        expect(other.ok).toBe(true);
    });

    it('explains why, rather than failing silently', async () => {
        const result = await setUserStatus(ADMIN_ID, 'inactive');

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.message).toMatch(/lock yourself out/i);
    });
});
