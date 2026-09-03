/**
 * Profile actions.
 *
 * Layer: ACTION — assertAuth -> zod.parse -> service -> revalidate (§3)
 * Stories: SP-021, SP-022
 *
 * Three actions, one shared ending (`settle`). What is worth asserting is the
 * same in each: the id comes from the session and never the form, a parse
 * failure never reaches the service, and a service failure never reaches
 * revalidatePath — because a revalidate after a failed write repaints the old
 * value under a message saying it was saved.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    setCategoryLevelAction,
    updateInterestsAction,
    updateNameAction,
} from '../../../../app/(student)/profile/actions';
import * as profileService from '../../../../lib/services/profile.service';
import { assertAuth } from '../../../../lib/auth/assertAuth';
import { revalidatePath } from 'next/cache';
import { aCurrentUser, MEMBER_ID } from '../../../helpers/builders';
import { ok, err } from '../../../../lib/result';
import { appError } from '../../../../lib/errors';
import { IDLE } from '../../../../lib/validation/common';

vi.mock('../../../../lib/services/profile.service');
vi.mock('../../../../lib/auth/assertAuth');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string | string[]>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        if (Array.isArray(v)) v.forEach((x) => data.append(k, x));
        else data.set(k, v);
    }
    return data;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAuth).mockResolvedValue(aCurrentUser());
    vi.mocked(profileService.updateName).mockResolvedValue(ok(undefined));
    vi.mocked(profileService.setInterests).mockResolvedValue(ok(undefined));
    vi.mocked(profileService.setCategoryLevel).mockResolvedValue(ok(undefined));
});

describe('updateNameAction', () => {
    it('renames the SESSION user, whatever the form claims', async () => {
        await updateNameAction(IDLE, form({ firstName: 'Ada', lastName: 'Lovelace', userId: '999' }));

        expect(profileService.updateName).toHaveBeenCalledWith(MEMBER_ID, 'Ada', 'Lovelace');
    });

    it('treats a missing last name as empty rather than undefined', async () => {
        // `formData.get('lastName') ?? ''` — the schema would reject undefined,
        // and a member with a one-word name is not a validation failure.
        await updateNameAction(IDLE, form({ firstName: 'Prince' }));

        expect(profileService.updateName).toHaveBeenCalledWith(MEMBER_ID, 'Prince', '');
    });

    it('returns field errors on a bad name and never calls the service', async () => {
        const result = await updateNameAction(IDLE, form({ firstName: '', lastName: '' }));

        expect(result.status).toBe('error');
        expect(result.fields).toBeDefined();
        expect(profileService.updateName).not.toHaveBeenCalled();
    });

    it('revalidates the profile AND the layout on success', async () => {
        // The header prints the name; revalidating only /profile shows the new
        // name in the section and the old one in the bar above it.
        await updateNameAction(IDLE, form({ firstName: 'Ada', lastName: 'Lovelace' }));

        expect(revalidatePath).toHaveBeenCalledWith('/profile');
        expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('does not revalidate when the service fails', async () => {
        vi.mocked(profileService.updateName).mockResolvedValue(
            err(appError('unknown', 'Something went wrong. Try again.')),
        );

        const result = await updateNameAction(IDLE, form({ firstName: 'Ada', lastName: 'Lovelace' }));

        expect(result.status).toBe('error');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});

describe('updateInterestsAction', () => {
    it('passes every selected category', async () => {
        await updateInterestsAction(IDLE, form({ categoryIds: ['1', '2', '3'] }));

        expect(profileService.setInterests).toHaveBeenCalledWith(MEMBER_ID, [1, 2, 3]);
    });

    it('accepts an empty selection — following nothing is a valid state', async () => {
        await updateInterestsAction(IDLE, form({}));

        expect(profileService.setInterests).toHaveBeenCalledWith(MEMBER_ID, []);
    });

    it('reports success with a message', async () => {
        const result = await updateInterestsAction(IDLE, form({ categoryIds: ['1'] }));

        expect(result).toEqual({ status: 'success', message: 'Interests updated.' });
    });
});

describe('setCategoryLevelAction', () => {
    it('sends the category and level from the form, with the session user', async () => {
        await setCategoryLevelAction(IDLE, form({ categoryId: '4', level: 'advanced' }));

        expect(profileService.setCategoryLevel).toHaveBeenCalledWith(MEMBER_ID, 4, 'advanced');
    });

    it('rejects a level outside the three', async () => {
        const result = await setCategoryLevelAction(IDLE, form({ categoryId: '4', level: 'wizard' }));

        expect(result).toEqual({ status: 'error', message: 'Pick one of the three levels.', fields: undefined });
        expect(profileService.setCategoryLevel).not.toHaveBeenCalled();
    });

    it('carries a service field error back to the form', async () => {
        vi.mocked(profileService.setCategoryLevel).mockResolvedValue(
            err(appError('validation', 'Pick a category you follow.', { categoryId: 'Not one of yours.' })),
        );

        const result = await setCategoryLevelAction(IDLE, form({ categoryId: '4', level: 'advanced' }));

        expect(result.fields).toEqual({ categoryId: 'Not one of yours.' });
    });
});
