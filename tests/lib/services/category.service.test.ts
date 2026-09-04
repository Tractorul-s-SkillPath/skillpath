/**
 * Tests for lib/services/category.service.ts.
 *
 * Stories: SP-030, SP-031, SP-032, SP-040
 *
 * These functions are thin, so the assertions that matter are about order, not
 * transformation: assertAdmin() has to run BEFORE the repository is touched.
 * A guard that runs after the read has already happened is not a guard, and it
 * would pass any test that only checked the return value.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assertAdmin } from '../../../lib/auth/assertAdmin';
import * as categoryRepo from '../../../lib/repositories/category.repo';
import { FAKE_CLIENT } from '../../helpers/in-memory-repos';
import { aCatalogCategory, aCategory, anAdmin } from '../../helpers/builders';
import {
    listCategories,
    getCategory,
    createCategory,
    setCategoryStatus,
} from '../../../lib/services/category.service';

vi.mock('../../../lib/auth/assertAdmin');
vi.mock('../../../lib/repositories/category.repo');
vi.mock('../../../lib/supabase/server', () => ({
    // The admin services query through createServiceClient — service role, because
    // RLS has no admin policy and every write here would be refused with 42501.
    // Mocked alongside createClient so a service that is moved between the two
    // fails on its assertions rather than on an undefined import.
    createClient: vi.fn(async () => FAKE_CLIENT),
    createServiceClient: vi.fn(() => FAKE_CLIENT),
}));

/** What assertAdmin does to a non-admin: redirect() throws, so nothing returns. */
const REDIRECTED = new Error('NEXT_REDIRECT /dashboard');

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAdmin).mockResolvedValue(anAdmin());
});

describe('the admin guard', () => {
    it.each([
        ['listCategories', () => listCategories()],
        ['getCategory', () => getCategory(3)],
        ['createCategory', () => createCategory({ name: 'X', description: 'Y' })],
        ['setCategoryStatus', () => setCategoryStatus(3, 'inactive')],
    ])('stops %s before it reaches the database', async (_name, call) => {
        vi.mocked(assertAdmin).mockRejectedValue(REDIRECTED);

        await expect(call()).rejects.toThrow(REDIRECTED);

        expect(categoryRepo.listWithQuestionCounts).not.toHaveBeenCalled();
        expect(categoryRepo.findById).not.toHaveBeenCalled();
        expect(categoryRepo.insert).not.toHaveBeenCalled();
        expect(categoryRepo.setStatus).not.toHaveBeenCalled();
    });
});

describe('listCategories', () => {
    it('returns the catalog with question counts attached', async () => {
        const catalog = [
            aCatalogCategory(),
            aCatalogCategory({ categoryId: 4, status: 'inactive' }),
        ];
        vi.mocked(categoryRepo.listWithQuestionCounts).mockResolvedValue({
            ok: true,
            value: catalog,
        });

        await expect(listCategories()).resolves.toEqual({ ok: true, value: catalog });
    });

    it('includes inactive categories — this is the admin view, not the picker', async () => {
        const catalog = [aCatalogCategory({ status: 'inactive' })];
        vi.mocked(categoryRepo.listWithQuestionCounts).mockResolvedValue({
            ok: true,
            value: catalog,
        });

        const result = await listCategories();

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // The service does no filtering of its own; if it ever starts, the
        // admin loses the only screen that can reactivate a category.
        expect(result.value).toHaveLength(1);
    });
});

describe('getCategory', () => {
    it('returns the category the admin asked for', async () => {
        const category = aCategory();
        vi.mocked(categoryRepo.findById).mockResolvedValue({ ok: true, value: category });

        await expect(getCategory(3)).resolves.toEqual({ ok: true, value: category });
        expect(categoryRepo.findById).toHaveBeenCalledWith(FAKE_CLIENT, 3);
    });

    it('propagates a not_found for an id that does not exist', async () => {
        vi.mocked(categoryRepo.findById).mockResolvedValue({
            ok: false,
            error: { code: 'not_found', message: 'Not found.' },
        });

        const result = await getCategory(999);

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('not_found');
    });
});

describe('createCategory', () => {
    it('passes the validated name and description through', async () => {
        vi.mocked(categoryRepo.insert).mockResolvedValue({ ok: true, value: aCategory() });

        await createCategory({ name: 'Databases', description: 'Query performance.' });

        expect(categoryRepo.insert).toHaveBeenCalledWith(
            FAKE_CLIENT,
            'Databases',
            'Query performance.',
        );
    });

    it('propagates a conflict on a duplicate name rather than swallowing it', async () => {
        vi.mocked(categoryRepo.insert).mockResolvedValue({
            ok: false,
            error: { code: 'conflict', message: 'That already exists.' },
        });

        const result = await createCategory({ name: 'Databases', description: 'x' });

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('conflict');
    });
});

describe('setCategoryStatus', () => {
    it.each(['active', 'inactive'] as const)(
        'sends %s straight to the repository',
        async (status) => {
            vi.mocked(categoryRepo.setStatus).mockResolvedValue({ ok: true, value: undefined });

            await setCategoryStatus(3, status);

            expect(categoryRepo.setStatus).toHaveBeenCalledWith(FAKE_CLIENT, 3, status);
        },
    );
});
