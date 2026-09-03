/**
 * user.repo — against the real test database.
 *
 * Stories: SP-083, SP-014
 *
 * The admin user table: searched, filtered and paged IN THE DATABASE. Three
 * things here are only true against a real one:
 *
 *  - `USER_PUBLIC_COLUMNS` is what stops `users.password` travelling into a
 *    table component. A fake returning a hand-written row proves nothing about
 *    which columns PostgREST was actually asked for; this file asserts the
 *    column is absent from what comes back.
 *  - `.or('first_name.ilike.…,last_name.ilike.…,email.ilike.…')` with
 *    `likeTerm`'s quoting. `paging.test.ts` pins the string that goes in;
 *    only a real request says whether PostgREST accepts it. A term containing
 *    a comma used to come back 400.
 *  - `count: 'exact'` alongside `.range()` — the total is the server's, not
 *    `items.length`, and the difference only shows on a page that is not the
 *    last one.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as userRepo from '../../../lib/repositories/user.repo';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

let db: TestClient;
let sandbox: Sandbox;

/** A filter set that matches everything, so a test names only what it changes. */
const filters = (overrides: Partial<userRepo.UserFilters> = {}): userRepo.UserFilters => ({
    search: '',
    role: null,
    status: null,
    page: 1,
    pageSize: 25,
    ...overrides,
});

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'user-repo');
});

afterAll(async () => {
    await sandbox.destroy();
});

describe('listPaged', () => {
    it('never returns the password column', async () => {
        // The reason USER_PUBLIC_COLUMNS exists. `select('*')` here would put a
        // scrypt hash in the props of an admin table component, and nothing
        // downstream would notice — it would simply be carried, rendered
        // nowhere, and serialised into the page.
        const member = await sandbox.createUser();

        const result = await userRepo.listPaged(db, filters({ search: member.email }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const row = result.value.items.find((u) => u.userId === member.userId);

        expect(row).toBeDefined();
        expect(Object.keys(row!)).not.toContain('password');
        expect(JSON.stringify(row)).not.toContain('aa:bb');
    });

    it('finds a member by email, first name and last name', async () => {
        const member = await sandbox.createUser({ firstName: 'Wilhelmina', lastName: 'Ashgrove' });

        for (const term of ['Wilhelmina', 'Ashgrove', member.email]) {
            const result = await userRepo.listPaged(db, filters({ search: term }));

            expect(result.ok, `searching for ${term}`).toBe(true);
            if (!result.ok) return;

            expect(
                result.value.items.map((u) => u.userId),
                `searching for ${term}`,
            ).toContain(member.userId);
        }
    });

    it('matches on a fragment, case-insensitively', async () => {
        const member = await sandbox.createUser({ firstName: 'Wilhelmina', lastName: 'Ashgrove' });

        const result = await userRepo.listPaged(db, filters({ search: 'HELMIN' }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.items.map((u) => u.userId)).toContain(member.userId);
    });

    it('accepts a search term containing a comma, a bracket and a dot', async () => {
        // The bug likeTerm exists for. `.or()` takes its filters as one string,
        // so an unquoted comma ends the clause early and everything after it is
        // parsed as another filter — PostgREST answers 400 and the admin sees
        // an error page for typing a name naturally.
        const result = await userRepo.listPaged(db, filters({ search: 'ana, pop (x). y' }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value.items).toEqual([]);
        expect(result.value.total).toBe(0);
    });

    it('filters by role and by status', async () => {
        const admin = await sandbox.createUser({ role: 'admin' });
        const inactive = await sandbox.createUser({ status: 'inactive' });

        const admins = await userRepo.listPaged(db, filters({ role: 'admin', search: sandbox.name }));
        expect(admins.ok).toBe(true);
        if (!admins.ok) return;

        const adminIds = admins.value.items.map((u) => u.userId);
        expect(adminIds).toContain(admin.userId);
        expect(adminIds).not.toContain(inactive.userId);

        const deactivated = await userRepo.listPaged(
            db,
            filters({ status: 'inactive', search: sandbox.name }),
        );
        expect(deactivated.ok).toBe(true);
        if (!deactivated.ok) return;

        const inactiveIds = deactivated.value.items.map((u) => u.userId);
        expect(inactiveIds).toContain(inactive.userId);
        expect(inactiveIds).not.toContain(admin.userId);
    });

    it('combines a search with a filter rather than replacing it', async () => {
        const admin = await sandbox.createUser({ role: 'admin', firstName: 'Overlap' });
        const student = await sandbox.createUser({ role: 'student', firstName: 'Overlap' });

        const result = await userRepo.listPaged(
            db,
            filters({ search: sandbox.name, role: 'admin' }),
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const ids = result.value.items.map((u) => u.userId);

        // Both members match the search; only one matches the role. Membership
        // rather than an exact array, because tests above this one also make
        // admins carrying the same sandbox tag — an assertion that breaks when
        // a test is added above it costs maintenance and diagnoses nothing.
        expect(ids).toContain(admin.userId);
        expect(ids).not.toContain(student.userId);
    });

    it('pages, and reports the SERVER total rather than the page length', async () => {
        // The assertion that needs `count: 'exact'`. With the count dropped,
        // `toPage` falls back to `items.length` and every page claims to be the
        // only one — the pager disappears and the rest of the members with it.
        for (let i = 0; i < 3; i += 1) await sandbox.createUser();

        const search = sandbox.name;

        const page1 = await userRepo.listPaged(db, filters({ search, page: 1, pageSize: 2 }));
        expect(page1.ok).toBe(true);
        if (!page1.ok) return;

        expect(page1.value.items).toHaveLength(2);
        expect(page1.value.total).toBeGreaterThanOrEqual(3);
        expect(page1.value.totalPages).toBeGreaterThanOrEqual(2);

        const page2 = await userRepo.listPaged(db, filters({ search, page: 2, pageSize: 2 }));
        expect(page2.ok).toBe(true);
        if (!page2.ok) return;

        const firstIds = page1.value.items.map((u) => u.userId);
        const secondIds = page2.value.items.map((u) => u.userId);

        // Page 2 must be different rows, not the same ones again — the failure
        // an off-by-one in pageRange produces.
        expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    });

    it('FAILS past the last page instead of returning an empty one', async () => {
        // Pinning a BUG, not a design, and the reason this folder exists.
        //
        // PostgREST answers PGRST103 "Requested range not satisfiable" when the
        // offset is past the row count. `fromPostgrestError` has no case for
        // it, so it falls to the default and the admin gets "Something went
        // wrong. Try again." instead of an empty table.
        //
        // `filters.schema.ts` clamps `?page=` to 1..10_000 and its header says
        // that makes a hand-edited page number safe. It does not: safety here
        // means the page is within THIS result set, which the schema cannot
        // know. Thirty members at a page size of 25 is two pages, and `?page=3`
        // is an error page.
        //
        // Reachable without touching the URL: page to the end of the members
        // list and then narrow the filter — the page number survives in the
        // query string while the result set shrinks under it.
        //
        // When it is fixed — clamp to totalPages in the service, or map
        // PGRST103 to an empty page in fromPostgrestError — this test starts
        // failing. Rewrite it to assert the empty page; do not delete it.
        const result = await userRepo.listPaged(
            db,
            filters({ search: sandbox.name, page: 99, pageSize: 25 }),
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;

        expect(result.error.code).toBe('unknown');
    });

    it('orders newest first', async () => {
        const first = await sandbox.createUser();
        const second = await sandbox.createUser();

        const result = await userRepo.listPaged(db, filters({ search: sandbox.name }));

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const ids = result.value.items.map((u) => u.userId);

        expect(ids.indexOf(second.userId)).toBeLessThan(ids.indexOf(first.userId));
    });
});

describe('setStatus', () => {
    it('deactivates and reactivates a member', async () => {
        const member = await sandbox.createUser();

        expect((await userRepo.setStatus(db, member.userId, 'inactive')).ok).toBe(true);

        const after = await userRepo.listPaged(db, filters({ search: member.email }));
        expect(after.ok).toBe(true);
        if (!after.ok) return;
        expect(after.value.items[0]?.status).toBe('inactive');

        expect((await userRepo.setStatus(db, member.userId, 'active')).ok).toBe(true);

        const back = await userRepo.listPaged(db, filters({ search: member.email }));
        expect(back.ok && back.value.items[0]?.status).toBe('active');
    });

    it('reports success for a user id that matches nothing', async () => {
        // Same gap as category.repo.setStatus, recorded for the same reason:
        // PostgREST does not call a zero-row UPDATE an error, and this function
        // does not ask for a count, so the caller cannot tell.
        expect((await userRepo.setStatus(db, -1, 'inactive')).ok).toBe(true);
    });
});
