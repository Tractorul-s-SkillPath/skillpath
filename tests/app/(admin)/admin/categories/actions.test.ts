/**
 * Category actions.
 *
 * Layer: ACTION. Stories: SP-031, SP-032
 *
 * Two bugs the source header records, both of them the kind that report success
 * for work that did not happen. This file exists to keep them fixed:
 *
 *  1. `createCategoryAction` used to wrap the service in try/catch. A service
 *     here does not THROW on failure — it returns `{ ok: false }` — so the
 *     catch caught nothing and the success path ran on a failed write. That is
 *     how "Category created successfully!" came back from a create that never
 *     happened.
 *  2. `setCategoryStatusAction` used to catch, log, and return nothing at all,
 *     so a failed update was indistinguishable from a successful one: the page
 *     re-rendered with the old status and said nothing.
 *
 * The third case is SP-031 AC2: a duplicate name is a field error next to the
 * input, never a 500 and never the same sentence printed twice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createCategoryAction,
    setCategoryStatusAction,
} from '../../../../../app/(admin)/admin/categories/actions';
import * as categoryService from '../../../../../lib/services/category.service';
import { revalidatePath } from 'next/cache';
import { ok, err } from '../../../../../lib/result';
import { appError } from '../../../../../lib/errors';
import { IDLE } from '../../../../../lib/validation/common';

vi.mock('../../../../../lib/services/category.service');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [k, v] of Object.entries(fields)) data.set(k, v);
    return data;
};

const aCategory = { categoryId: 3, name: 'Databases', description: 'Relational modelling.' };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(categoryService.createCategory).mockResolvedValue(ok(aCategory));
    vi.mocked(categoryService.setCategoryStatus).mockResolvedValue(ok(undefined));
});

describe('createCategoryAction', () => {
    it('creates and reports the name back', async () => {
        const result = await createCategoryAction(
            IDLE,
            form({ name: 'Databases', description: 'Relational modelling.' }),
        );

        expect(categoryService.createCategory).toHaveBeenCalledWith({
            name: 'Databases',
            description: 'Relational modelling.',
        });
        expect(result).toEqual({ status: 'success', message: '"Databases" created.' });
    });

    it('DOES NOT report success when the service returns a failure', async () => {
        // Bug 1. A `Result` failure is a plain return value, so nothing throws
        // and a try/catch around it is a no-op.
        vi.mocked(categoryService.createCategory).mockResolvedValue(
            err(appError('unknown', 'Something went wrong. Try again.')),
        );

        const result = await createCategoryAction(
            IDLE,
            form({ name: 'Databases', description: 'x' }),
        );

        expect(result.status).toBe('error');
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('puts a duplicate name next to the field and does not repeat it as the summary', async () => {
        // SP-031 AC2. The repository attaches the explanation to `name`;
        // echoing `error.message` as the summary printed it twice, once under
        // the input and once beside the button.
        vi.mocked(categoryService.createCategory).mockResolvedValue(
            err(
                appError('conflict', 'A category with that name already exists.', {
                    name: 'A category with that name already exists.',
                }),
            ),
        );

        const result = await createCategoryAction(
            IDLE,
            form({ name: 'Databases', description: 'x' }),
        );

        expect(result.message).toBe('Check the fields below.');
        expect(result.fields).toEqual({ name: 'A category with that name already exists.' });
    });

    it('falls back to the message when a failure carries no field', async () => {
        vi.mocked(categoryService.createCategory).mockResolvedValue(
            err(appError('forbidden', "You don't have access to that.")),
        );

        const result = await createCategoryAction(
            IDLE,
            form({ name: 'Databases', description: 'x' }),
        );

        expect(result.message).toBe("You don't have access to that.");
        expect(result.fields).toBeUndefined();
    });

    it('rejects an empty name in the action, before the service', async () => {
        const result = await createCategoryAction(IDLE, form({ name: '', description: 'x' }));

        expect(result.status).toBe('error');
        expect(result.fields).toBeDefined();
        expect(categoryService.createCategory).not.toHaveBeenCalled();
    });

    it('revalidates the catalog on success', async () => {
        await createCategoryAction(IDLE, form({ name: 'Databases', description: 'x' }));

        expect(revalidatePath).toHaveBeenCalledWith('/admin/categories');
    });
});

describe('setCategoryStatusAction', () => {
    it('deactivates and says the assessments are untouched', async () => {
        // SP-032: this is a status change, never a delete. The message is the
        // only place an admin is told that.
        const result = await setCategoryStatusAction(
            IDLE,
            form({ categoryId: '3', status: 'inactive' }),
        );

        expect(categoryService.setCategoryStatus).toHaveBeenCalledWith(3, 'inactive');
        expect(result.message).toBe('Category deactivated — existing assessments are untouched.');
    });

    it('activates', async () => {
        const result = await setCategoryStatusAction(
            IDLE,
            form({ categoryId: '3', status: 'active' }),
        );

        expect(result).toEqual({ status: 'success', message: 'Category activated.' });
    });

    it('REPORTS a failed update rather than returning nothing', async () => {
        // Bug 2. A failure the person who caused it cannot see is worse than an
        // error message.
        vi.mocked(categoryService.setCategoryStatus).mockResolvedValue(
            err(appError('not_found', 'That category no longer exists.')),
        );

        const result = await setCategoryStatusAction(
            IDLE,
            form({ categoryId: '3', status: 'inactive' }),
        );

        expect(result.status).toBe('error');
        expect(result.message).toBe('That category no longer exists.');
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('rejects a bad id or status without calling the service', async () => {
        expect(
            (await setCategoryStatusAction(IDLE, form({ categoryId: 'abc', status: 'active' })))
                .status,
        ).toBe('error');
        expect(
            (await setCategoryStatusAction(IDLE, form({ categoryId: '3', status: 'hidden' })))
                .status,
        ).toBe('error');
        expect(categoryService.setCategoryStatus).not.toHaveBeenCalled();
    });
});
