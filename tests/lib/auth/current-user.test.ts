/**
 * getCurrentUser — against the real test database, through a real session.
 *
 * Stories: SP-010, SP-011, SP-012
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE STOPPED TESTING, AND WHY THAT IS NOT A LOSS OF COVERAGE.
 * ---------------------------------------------------------------------------
 *
 * The previous version was 694 lines and most of it tested code that no longer
 * exists: a scrypt hash/verify pair, an account-creation branch inside
 * loginAction, and a signed cookie of our own. Passwords are Supabase's now, in
 * `auth.users`, hashed by them; sign-in is `signInWithPassword` in
 * app/(auth)/login/actions.ts, tested there; the session is Supabase's.
 *
 * Deleting those tests removes assertions about deleted code, not assertions
 * about behaviour. The behaviour that survived is the reason this file is still
 * database-backed rather than a unit test with a double:
 *
 *   1. The profile join. `auth.users` knows an id and an email; everything this
 *      application cares about — name, role, status — is in `public.users`, and
 *      getCurrentUser() is the one place the two are put together.
 *
 *   2. RLS. Every read here goes through an anon-key client carrying a real
 *      user token, so `auth.uid()` is set and the policies apply. A double
 *      cannot tell a query that is allowed from one the database would refuse,
 *      and that distinction is the entire point of the security migration.
 *
 * `memberClient()` is what makes the second one possible; tests/helpers has the
 * note about why that helper could not exist before this branch.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    Sandbox,
    memberClient,
    testClient,
    type SandboxUser,
    type TestClient,
} from '../../helpers/supabase-test-client';

/**
 * Whatever the current test wants getCurrentUser() to be looking through.
 *
 * lib/supabase/server.ts reads request cookies, which do not exist outside a
 * request — so the module is replaced and the client swapped per test. Every
 * client assigned here is a REAL one against the test project; the mock decides
 * whose session is in play, not what the database does.
 */
let clientForRequest: TestClient | null = null;

vi.mock('../../../lib/supabase/server', () => ({
    createClient: async () => clientForRequest,
    createServiceClient: () => testClient(),
}));

const { getCurrentUser } = await import('../../../lib/auth/current-user');

let db: TestClient;
let sandbox: Sandbox;

let member: SandboxUser;
let other: SandboxUser;
let admin: SandboxUser;

beforeAll(async () => {
    db = testClient();
    sandbox = new Sandbox(db, 'current-user');

    member = await sandbox.createUser({ firstName: 'Ada', lastName: 'Lovelace' });
    other = await sandbox.createUser({ firstName: 'Grace', lastName: 'Hopper' });
    admin = await sandbox.createUser({ firstName: 'Root', role: 'admin' });
});

afterAll(async () => {
    await sandbox.destroy();
});

describe('behind a real session', () => {
    it('loads the profile that belongs to the signed-in account', async () => {
        clientForRequest = await memberClient(member);

        const current = await getCurrentUser();

        expect(current).not.toBeNull();
        expect(current!.userId).toBe(member.userId);
        expect(current!.email).toBe(member.email);
        expect(current!.user.first_name).toBe('Ada');
    });

    it('returns a UUID, not a number', async () => {
        // The shape changed with the schema, and a test that only checked
        // truthiness would not notice a repository quietly coercing it.
        clientForRequest = await memberClient(member);

        const current = await getCurrentUser();

        expect(typeof current!.userId).toBe('string');
        expect(current!.userId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
    });

    it('carries no password field, because there is no longer a column', async () => {
        clientForRequest = await memberClient(member);

        const current = await getCurrentUser();

        expect(current!.user).not.toHaveProperty('password');
    });

    it('reads the role from the database, never from the token', async () => {
        // The JWT is minted at sign-in and stays valid for its lifetime, so a
        // role read out of it would be stale for exactly as long as the token
        // lives. This demotes an admin AFTER their session exists: a build that
        // trusted a custom claim would still report 'admin' here.
        const client = await memberClient(admin);
        clientForRequest = client;

        expect((await getCurrentUser())!.role).toBe('admin');

        await db.from('users').update({ role: 'student' }).eq('user_id', admin.userId);

        // Same session, same token, no re-authentication.
        expect((await getCurrentUser())!.role).toBe('student');

        await db.from('users').update({ role: 'admin' }).eq('user_id', admin.userId);
    });

    it('reports a status change on the same session, so a ban takes effect', async () => {
        // assertAuth() bounces on anything but 'active' (SP-014). It can only
        // do that if this reads the column live.
        const client = await memberClient(member);
        clientForRequest = client;

        await db.from('users').update({ status: 'inactive' }).eq('user_id', member.userId);

        expect((await getCurrentUser())!.status).toBe('inactive');

        await db.from('users').update({ status: 'active' }).eq('user_id', member.userId);
    });
});

describe('with no usable session', () => {
    it('is null when nobody is signed in', async () => {
        // The anon key with no token at all: getUser() has nothing to verify.
        clientForRequest = await memberClient(member);
        await clientForRequest.auth.signOut();

        expect(await getCurrentUser()).toBeNull();
    });

    it('is null when the account has been deleted underneath the session', async () => {
        // Deliberately NOT sandbox.createUser(): this test deletes the account
        // itself, and destroy() would then fail with "User not found" for a row
        // the test removed on purpose — reporting a teardown problem where
        // there is none, and taking the whole file down with it.
        const email = `doomed-${sandbox.name}@skillpath.test`;
        const password = 'sandbox-password-1234';

        const { data: created, error } = await db.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { first_name: 'Doomed', last_name: sandbox.name },
        });

        if (error || !created.user) throw new Error(`could not create: ${error?.message}`);

        const doomed = {
            userId: created.user.id,
            email,
            password,
            firstName: 'Doomed',
            lastName: sandbox.name,
        };

        clientForRequest = await memberClient(doomed);

        expect(await getCurrentUser()).not.toBeNull();

        await db.auth.admin.deleteUser(doomed.userId);

        // getUser() verifies against the auth server rather than decoding the
        // cookie, so the token stops working the moment the account does. A
        // build using getSession() would keep returning the deleted member
        // until the token expired.
        expect(await getCurrentUser()).toBeNull();
    });
});

describe('RLS is doing the work, not the .eq()', () => {
    it('a member reading the users table sees only themselves', async () => {
        // No filter at all. Under the "Acces profil propriu" policy this comes
        // back as exactly one row; with RLS off — or with the anon-key client
        // swapped back to service-role, which is the mistake this branch fixed
        // — it would come back as the whole table.
        const client = await memberClient(member);

        const { data, error } = await client.from('users').select('user_id');

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data![0].user_id).toBe(member.userId);
    });

    it('a member cannot read another member by asking for them directly', async () => {
        const client = await memberClient(member);

        const { data, error } = await client
            .from('users')
            .select('user_id, email')
            .eq('user_id', other.userId);

        // Zero rows, NOT an error. The two look identical from the UI, which is
        // why the count is what gets asserted.
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('a member cannot edit another member', async () => {
        const client = await memberClient(member);

        await client.from('users').update({ first_name: 'Pwned' }).eq('user_id', other.userId);

        // Read back with the service-role client: the victim's own client would
        // be subject to the same policy and could not prove the row survived.
        const { data } = await db
            .from('users')
            .select('first_name')
            .eq('user_id', other.userId)
            .single();

        expect(data!.first_name).toBe('Grace');
    });

    it('a member CAN edit their own row', async () => {
        // The mirror of the case above. Without it, a policy that denied
        // everything would pass every other test in this block.
        const client = await memberClient(member);

        const { error } = await client
            .from('users')
            .update({ first_name: 'Ada B.' })
            .eq('user_id', member.userId);

        expect(error).toBeNull();

        const { data } = await db
            .from('users')
            .select('first_name')
            .eq('user_id', member.userId)
            .single();

        expect(data!.first_name).toBe('Ada B.');

        await db.from('users').update({ first_name: 'Ada' }).eq('user_id', member.userId);
    });
});
