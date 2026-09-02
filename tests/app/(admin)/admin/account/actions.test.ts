/**
 * Admin account action.
 *
 * Layer: ACTION — assertAdmin -> zod.parse -> service -> revalidate (§3)
 *
 * A near-twin of the student `updateNameAction`, and the source header explains
 * at length why it is not an import of it: the guard differs (assertAdmin, not
 * assertAuth) and the revalidate targets differ (/admin/account, not /profile).
 * Those two differences are exactly what this file asserts — if somebody later
 * "removes the duplication" by importing the student action, both go red.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateAdminNameAction } from '../../../../../app/(admin)/admin/account/actions';
import * as profileService from '../../../../../lib/services/profile.service';
import { assertAdmin } from '../../../../../lib/auth/assertAdmin';
import { revalidatePath } from 'next/cache';
import { anAdmin, ADMIN_ID } from '../../../../helpers/builders';
import { ok, err } from '../../../../../lib/result';
import { appError } from '../../../../../lib/errors';
import { IDLE } from '../../../../../lib/validation/common';

vi.mock('../../../../../lib/services/profile.service');
vi.mock('../../../../../lib/auth/assertAdmin');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
    vi.mocked(profileService.updateName).mockResolvedValue(ok(undefined));
});

describe('updateAdminNameAction', () => {
    it('guards with assertAdmin, not assertAuth', async () => {
        // The page is admin-only; a guard that admits any signed-in member
        // would let a student rename themselves through an admin endpoint.
        await updateAdminNameAction(IDLE, form({ firstName: 'Root', lastName: 'Admin' }));

        expect(assertAdmin).toHaveBeenCalledOnce();
    });

    it('renames the session admin, never the id in the form', async () => {
        await updateAdminNameAction(IDLE, form({ firstName: 'Root', lastName: 'Admin', userId: '999' }));

        expect(profileService.updateName).toHaveBeenCalledWith(ADMIN_ID, 'Root', 'Admin');
    });

    it('revalidates /admin/account and the layout — not /profile', async () => {
        await updateAdminNameAction(IDLE, form({ firstName: 'Root', lastName: 'Admin' }));

        expect(revalidatePath).toHaveBeenCalledWith('/admin/account');
        // The admin header prints the name too.
        expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
        expect(revalidatePath).not.toHaveBeenCalledWith('/profile');
    });

    it('returns field errors and skips the service on a bad name', async () => {
        const result = await updateAdminNameAction(IDLE, form({ firstName: '', lastName: '' }));

        expect(result.status).toBe('error');
        expect(result.fields).toBeDefined();
        expect(profileService.updateName).not.toHaveBeenCalled();
    });

    it('does not revalidate when the service fails', async () => {
        vi.mocked(profileService.updateName).mockResolvedValue(
            err(appError('unknown', 'Something went wrong. Try again.')),
        );

        expect((await updateAdminNameAction(IDLE, form({ firstName: 'Root', lastName: 'Admin' }))).status).toBe('error');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
