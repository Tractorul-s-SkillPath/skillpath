/**
 * User admin action.
 *
 * Layer: ACTION. Stories: SP-083, SP-014
 *
 * NOTE WHAT IS NOT HERE: this action does not call assertAdmin. The guard lives
 * in `user-admin.service`, and that is on purpose — every path into the service
 * goes through it, so a second caller cannot forget. This file asserts the
 * action delegates rather than guarding, which is the arrangement the source
 * header describes; if the service's guard is ever removed, its own test goes
 * red, not this one.
 *
 * The behaviour worth pinning is idempotence. The form posts the status it
 * WANTS, not the one it currently sees: a row deactivated in another tab must
 * not be reactivated by a click that meant to deactivate it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setUserStatusAction } from '../../../../../app/(admin)/admin/users/actions';
import * as userAdminService from '../../../../../lib/services/user-admin.service';
import { revalidatePath } from 'next/cache';
import { ok, err } from '../../../../../lib/result';
import { appError } from '../../../../../lib/errors';
import { IDLE } from '../../../../../lib/validation/common';

vi.mock('../../../../../lib/services/user-admin.service');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userAdminService.setUserStatus).mockResolvedValue(ok(undefined));
});

describe('setUserStatusAction', () => {
    it('sends the TARGET status, so two clicks land on the same state', async () => {
        await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'inactive' }));
        await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'inactive' }));

        // Not a toggle. An earlier version posted `currentStatus` and flipped
        // it server-side, which made the outcome depend on how stale the page
        // was.
        expect(userAdminService.setUserStatus).toHaveBeenNthCalledWith(1, '00000000-0000-4000-8000-000000000007', 'inactive');
        expect(userAdminService.setUserStatus).toHaveBeenNthCalledWith(2, '00000000-0000-4000-8000-000000000007', 'inactive');
    });

    it('names what happened in the message', async () => {
        expect(await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'active' }))).toEqual({
            status: 'success',
            message: 'Account activated.',
        });

        expect(await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'inactive' }))).toEqual({
            status: 'success',
            message: 'Account deactivated.',
        });
    });

    it('revalidates the users table', async () => {
        await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'active' }));

        expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    });

    it.each([
        ['a non-numeric id', { userId: 'abc', status: 'active' }],
        ['a negative id', { userId: '-1', status: 'active' }],
        ['a status outside the enum', { userId: '00000000-0000-4000-8000-000000000007', status: 'banned' }],
    ])('rejects %s without calling the service', async (_label, fields) => {
        const result = await setUserStatusAction(IDLE, form(fields));

        expect(result.status).toBe('error');
        expect(userAdminService.setUserStatus).not.toHaveBeenCalled();
    });

    it('returns the service failure and does not revalidate', async () => {
        // The forbidden case: a signed-in student calling this endpoint with
        // curl. assertAdmin inside the service is what produces it.
        vi.mocked(userAdminService.setUserStatus).mockResolvedValue(
            err(appError('forbidden', "You don't have access to that.")),
        );

        const result = await setUserStatusAction(IDLE, form({ userId: '00000000-0000-4000-8000-000000000007', status: 'inactive' }));

        expect(result.status).toBe('error');
        expect(result.message).toBe("You don't have access to that.");
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
