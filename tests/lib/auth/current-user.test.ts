/**
 * current-user — against the real test database. SP-120 is what this closes.
 *
 * Stories: SP-010, SP-011, SP-012, SP-013
 *
 * WHY THIS FILE IS HERE AND NOT IN THE DEFAULT RUN. `lib/auth/current-user.ts`
 * builds its own supabase-js queries instead of going through a repository, and
 * `tests/README.md` rules out mocking supabase-js. That left it excluded from
 * the runner and excluded from the coverage gate — the only file in the project
 * whose test was *owed* rather than waived. It has been the most security-
 * relevant untested file in the repository the whole time: it hashes passwords,
 * verifies them, and decides who is an administrator.
 *
 * The three things mocked below are the ones that are not the database:
 *
 *  - `next/navigation`'s redirect, which in production throws to stop the
 *    action. The fake throws too, so control flow here matches control flow
 *    there — a redirect that merely recorded a call would let every test run
 *    on past the guard it was checking.
 *  - `next/cache`'s revalidatePath, which needs a request scope.
 *  - `next/headers`'s cookies, replaced with a plain jar so a session can be
 *    created and read back.
 *
 * `createClient` is pointed at the TEST PROJECT, not replaced with a fake. That
 * is the distinction tests/README.md draws: supplying a real client against a
 * real database is not mocking supabase-js, it is the alternative to it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sandbox, testClient, type TestClient } from '../../helpers/supabase-test-client';

// -----------------------------------------------------------------------------
// The three non-database seams
// -----------------------------------------------------------------------------

/** Thrown by the redirect fake, the way Next's own redirect throws. */
class Redirected extends Error {
    constructor(readonly url: string) {
        super(`redirect(${url})`);
    }
}

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Redirected(url);
    },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
        set: (name: string, value: string) => void jar.set(name, value),
        delete: (name: string) => void jar.delete(name),
    }),
}));

vi.mock('../../../lib/supabase/server', () => ({
    createClient: async () => testClient(),
}));

// Imported after the mocks are declared; vi.mock is hoisted, but keeping the
// order explicit stops a later edit from quietly breaking it.
const { getCurrentUser, loginAction, logoutAction, changePasswordAction, resetPasswordAction } =
    await import('../../../lib/auth/current-user');

let db: TestClient;
let sandbox: Sandbox;

/** Runs an action that is expected to redirect, and returns where to. */
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
    try {
        await run();
    } catch (error) {
        if (error instanceof Redirected) return error.url;
        throw error;
    }

    throw new Error('expected a redirect, but the action returned normally');
}

function form(fields: Record<string, string | string[]>): FormData {
    const data = new FormData();

    for (const [key, value] of Object.entries(fields)) {
        if (Array.isArray(value)) value.forEach((v) => data.append(key, v));
        else data.set(key, value);
    }

    return data;
}

const PASSWORD = 'correct horse battery';

beforeAll(() => {
    db = testClient();
    sandbox = new Sandbox(db, 'cur-user');

    // session.ts refuses to sign anything with a short secret, and every test
    // below either creates or reads a session.
    process.env.SESSION_SECRET ??= 'a'.repeat(64);
});

beforeEach(() => {
    jar.clear();
});

afterEach(() => {
    // getCurrentUser is wrapped in React's cache(), so a second call in the
    // same test would otherwise return the first call's answer — including the
    // null from before a session existed.
    vi.resetModules();
});

afterAll(async () => {
    // Accounts registered THROUGH loginAction are not sandbox-created, so they
    // are removed by the tag every test email carries.
    const { data: strays } = await db
        .from('users')
        .select('user_id')
        .like('email', `%${sandbox.name}%`);

    const ids = (strays ?? []).map((u) => u.user_id);

    if (ids.length > 0) {
        await db.from('category_progress').delete().in('user_id', ids);
        await db.from('xp_events').delete().in('user_id', ids);
        await db.from('users').delete().in('user_id', ids);
    }

    await sandbox.destroy();
});

describe('getCurrentUser', () => {
    it('is null with no session cookie', async () => {
        expect(await getCurrentUser()).toBeNull();
    });

    it('is null when the cookie is not a valid signature', async () => {
        // The forgery case session.test.ts covers in depth; here it matters
        // that a bad cookie reads as signed out rather than throwing.
        jar.set('skillpath_session', 'not-a-real-session');

        expect(await getCurrentUser()).toBeNull();
    });

    it('loads the member behind a real session, without their password', async () => {
        const member = await sandbox.createUser({ firstName: 'Ada', lastName: 'Lovelace' });

        const { createSession } = await import('../../../lib/auth/session');
        await createSession(member.userId);

        const current = await getCurrentUser();

        expect(current).not.toBeNull();
        expect(current?.userId).toBe(member.userId);
        expect(current?.email).toBe(member.email);
        expect(current?.role).toBe('student');
        // USER_PUBLIC_COLUMNS. `current.user` is handed to components.
        expect(Object.keys(current!.user)).not.toContain('password');
    });

    it('reads the role from the database, never from the cookie', async () => {
        // The guarantee the file header makes. The cookie carries a user id and
        // an expiry and nothing else, so promoting yourself means editing the
        // users table, not the cookie.
        const admin = await sandbox.createUser({ role: 'admin' });

        const { createSession } = await import('../../../lib/auth/session');
        await createSession(admin.userId);

        expect((await getCurrentUser())?.role).toBe('admin');
    });

    it('is null when the session points at a member who has been deleted', async () => {
        const member = await sandbox.createUser();

        const { createSession } = await import('../../../lib/auth/session');
        await createSession(member.userId);

        await db.from('users').delete().eq('user_id', member.userId);

        // A valid signature over a user id that no longer resolves. Without the
        // `if (!user) return null`, every page would treat this as signed in
        // and dereference a null row.
        expect(await getCurrentUser()).toBeNull();
    });
});

describe('loginAction — registering', () => {
    it('creates the account, hashes the password and never stores it in the clear', async () => {
        const email = `reg-${sandbox.name}@skillpath.test`;

        const where = await redirectOf(() =>
            loginAction(
                form({ email, password: PASSWORD, firstName: 'New', lastName: sandbox.name }),
            ),
        );

        expect(where).toBe('/success');

        const { data } = await db
            .from('users')
            .select('password, role, status, first_name')
            .eq('email', email)
            .single();

        expect(data?.first_name).toBe('New');
        expect(data?.role).toBe('student');
        expect(data?.status).toBe('active');

        // scrypt, `salt:key`. The assertion that matters is the second one:
        // storing the plaintext would satisfy "a password is present".
        expect(data?.password).toContain(':');
        expect(data?.password).not.toContain(PASSWORD);
        expect(data?.password?.split(':')[1]).toHaveLength(128);
    });

    it('records the interests picked at registration', async () => {
        const email = `regskills-${sandbox.name}@skillpath.test`;
        const category = await sandbox.createCategory();

        await redirectOf(() =>
            loginAction(
                form({
                    email,
                    password: PASSWORD,
                    firstName: 'Skilled',
                    lastName: sandbox.name,
                    skills: [String(category.categoryId)],
                }),
            ),
        );

        const { data: user } = await db
            .from('users')
            .select('user_id')
            .eq('email', email)
            .single();

        const { data: interests } = await db
            .from('category_progress')
            .select('category_id, current_level')
            .eq('user_id', user!.user_id);

        expect(interests).toHaveLength(1);
        expect(interests?.[0].category_id).toBe(category.categoryId);
        expect(interests?.[0].current_level).toBe('beginner');
    });

    it('refuses a duplicate email', async () => {
        const member = await sandbox.createUser();

        const where = await redirectOf(() =>
            loginAction(
                form({
                    email: member.email,
                    password: PASSWORD,
                    firstName: 'Someone',
                    lastName: 'Else',
                }),
            ),
        );

        expect(where).toBe('/register?error=email_already_exists');
    });

    it('refuses a duplicate first+last name', async () => {
        // Not tidiness: the e2e journeys need a fresh identity in BOTH fields
        // every run because of this rule.
        const member = await sandbox.createUser({ firstName: 'Twin', lastName: sandbox.name });

        const where = await redirectOf(() =>
            loginAction(
                form({
                    email: `other-${sandbox.name}@skillpath.test`,
                    password: PASSWORD,
                    firstName: 'Twin',
                    lastName: member.lastName,
                }),
            ),
        );

        expect(where).toBe('/register?error=name_already_exists');
    });

    it('will not hand out an administrator account without approval', async () => {
        // A signup form does not hand out accounts that can read the answer
        // key. The admin e2e journey has no way around this either — its
        // administrator comes from the seed.
        const where = await redirectOf(() =>
            loginAction(
                form({
                    email: `admin-${sandbox.name}@skillpath.test`,
                    password: PASSWORD,
                    firstName: 'Would-be',
                    lastName: 'Admin',
                    role: 'admin',
                }),
            ),
        );

        expect(where).toBe('/register?error=manager_approval_required');

        const { count } = await db
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('email', `admin-${sandbox.name}@skillpath.test`);

        expect(count).toBe(0);
    });

    it('creates an administrator when approval is supplied', async () => {
        const email = `approved-${sandbox.name}@skillpath.test`;

        const where = await redirectOf(() =>
            loginAction(
                form({
                    email,
                    password: PASSWORD,
                    firstName: 'Approved',
                    lastName: `Admin ${sandbox.name}`,
                    role: 'admin',
                    managerApproval: 'yes',
                }),
            ),
        );

        expect(where).toBe('/success');

        const { data } = await db.from('users').select('role').eq('email', email).single();
        expect(data?.role).toBe('admin');
    });
});

describe('loginAction — signing in', () => {
    /** Registers a member through the action, so the password is really hashed. */
    async function aRegisteredMember(suffix: string) {
        const email = `login-${suffix}-${sandbox.name}@skillpath.test`;

        await redirectOf(() =>
            loginAction(
                form({
                    email,
                    password: PASSWORD,
                    firstName: `Login${suffix}`,
                    lastName: sandbox.name,
                }),
            ),
        );

        jar.clear();

        return email;
    }

    it('signs a member in with the right password and sets a session', async () => {
        const email = await aRegisteredMember('ok');

        const where = await redirectOf(() => loginAction(form({ email, password: PASSWORD })));

        expect(where).toBe('/dashboard');
        expect(jar.has('skillpath_session')).toBe(true);
    });

    it('sends an administrator to the admin console', async () => {
        const email = `adminlogin-${sandbox.name}@skillpath.test`;

        await redirectOf(() =>
            loginAction(
                form({
                    email,
                    password: PASSWORD,
                    firstName: 'Console',
                    lastName: `Admin ${sandbox.name}`,
                    role: 'admin',
                    managerApproval: 'yes',
                }),
            ),
        );
        jar.clear();

        expect(await redirectOf(() => loginAction(form({ email, password: PASSWORD })))).toBe(
            '/admin',
        );
    });

    it('REJECTS a wrong password and sets no session', async () => {
        // The assertion the whole file is for. ARCHITECTURE §0 still records
        // this function as signing anyone in on an email alone; it does not,
        // and this is what keeps it that way.
        const email = await aRegisteredMember('wrong');

        const where = await redirectOf(() =>
            loginAction(form({ email, password: 'not the password' })),
        );

        expect(where).toBe('/login?error=invalid');
        expect(jar.has('skillpath_session')).toBe(false);
    });

    it('rejects an empty password', async () => {
        const email = await aRegisteredMember('empty');

        expect(await redirectOf(() => loginAction(form({ email, password: '' })))).toBe(
            '/login?error=invalid',
        );
        expect(jar.has('skillpath_session')).toBe(false);
    });

    it('rejects an unknown email as not_found', async () => {
        const where = await redirectOf(() =>
            loginAction(form({ email: `nobody-${sandbox.name}@skillpath.test`, password: PASSWORD })),
        );

        expect(where).toBe('/login?error=not_found');
    });

    it('refuses a deactivated account before it checks the password', async () => {
        const email = await aRegisteredMember('disabled');
        await db.from('users').update({ status: 'inactive' }).eq('email', email);

        const where = await redirectOf(() => loginAction(form({ email, password: PASSWORD })));

        expect(where).toBe('/login?error=disabled');
        expect(jar.has('skillpath_session')).toBe(false);
    });

    it('treats an account with an unhashed password as unable to sign in', async () => {
        // A row seeded with plaintext has no colon, so verifyPassword bails and
        // isPasswordValid stays false. That is the safe direction — the account
        // exists but cannot be entered — and worth pinning, because the
        // alternative reading of `user.password.includes(':')` would be to skip
        // the check entirely for such rows.
        const member = await sandbox.createUser();
        await db.from('users').update({ password: 'plaintext' }).eq('user_id', member.userId);

        const where = await redirectOf(() =>
            loginAction(form({ email: member.email, password: 'plaintext' })),
        );

        expect(where).toBe('/login?error=invalid');
    });

    it('lowercases and trims the email before looking it up', async () => {
        const email = await aRegisteredMember('case');

        const where = await redirectOf(() =>
            loginAction(form({ email: `  ${email.toUpperCase()}  `, password: PASSWORD })),
        );

        expect(where).toBe('/dashboard');
    });

    it('honours a safe `next`, and ignores an off-site one', async () => {
        const email = await aRegisteredMember('next');

        expect(
            await redirectOf(() => loginAction(form({ email, password: PASSWORD, next: '/plan' }))),
        ).toBe('/plan');

        jar.clear();

        // `//evil.example` is protocol-relative — a browser treats it as
        // another origin, so an open redirect straight off the login form.
        expect(
            await redirectOf(() =>
                loginAction(form({ email, password: PASSWORD, next: '//evil.example' })),
            ),
        ).toBe('/dashboard');

        jar.clear();

        expect(
            await redirectOf(() =>
                loginAction(form({ email, password: PASSWORD, next: 'https://evil.example' })),
            ),
        ).toBe('/dashboard');
    });
});

describe('resetPasswordAction', () => {
    it('rejects a short password without touching the row', async () => {
        const member = await sandbox.createUser();

        const { data: before } = await db
            .from('users')
            .select('password')
            .eq('user_id', member.userId)
            .single();

        const result = await resetPasswordAction(
            form({ email: member.email, newPassword: 'short', confirmPassword: 'short' }),
        );

        expect(result).toEqual({ error: 'password_too_short' });

        const { data: after } = await db
            .from('users')
            .select('password')
            .eq('user_id', member.userId)
            .single();

        expect(after?.password).toBe(before?.password);
    });

    it('rejects a mismatched confirmation', async () => {
        const member = await sandbox.createUser();

        expect(
            await resetPasswordAction(
                form({
                    email: member.email,
                    newPassword: 'a long enough one',
                    confirmPassword: 'a different one',
                }),
            ),
        ).toEqual({ error: 'passwords_dont_match' });
    });

    it('rejects a missing email', async () => {
        expect(
            await resetPasswordAction(
                form({ email: '', newPassword: PASSWORD, confirmPassword: PASSWORD }),
            ),
        ).toEqual({ error: 'missing_email' });
    });

    it('sets a new password the member can then sign in with', async () => {
        const email = `reset-${sandbox.name}@skillpath.test`;

        await redirectOf(() =>
            loginAction(
                form({ email, password: PASSWORD, firstName: 'Reset', lastName: sandbox.name }),
            ),
        );
        jar.clear();

        const next = 'a brand new password';

        expect(
            await resetPasswordAction(
                form({ email, newPassword: next, confirmPassword: next }),
            ),
        ).toEqual({ success: true });

        expect(await redirectOf(() => loginAction(form({ email, password: next })))).toBe(
            '/dashboard',
        );

        jar.clear();

        expect(await redirectOf(() => loginAction(form({ email, password: PASSWORD })))).toBe(
            '/login?error=invalid',
        );
    });

    it('reports success for an address nobody holds', async () => {
        // A zero-row UPDATE is not an error, so this returns success — which is
        // the right answer to give a stranger, because saying "no such account"
        // tells them which addresses are registered. Pinned deliberately: it
        // looks like a missing check and is not one.
        expect(
            await resetPasswordAction(
                form({
                    email: `ghost-${sandbox.name}@skillpath.test`,
                    newPassword: 'a long enough one',
                    confirmPassword: 'a long enough one',
                }),
            ),
        ).toEqual({ success: true });
    });
});

describe('changePasswordAction', () => {
    async function signedIn(suffix: string) {
        const email = `chg-${suffix}-${sandbox.name}@skillpath.test`;

        await redirectOf(() =>
            loginAction(
                form({
                    email,
                    password: PASSWORD,
                    firstName: `Chg${suffix}`,
                    lastName: sandbox.name,
                }),
            ),
        );

        jar.clear();
        await redirectOf(() => loginAction(form({ email, password: PASSWORD })));

        return email;
    }

    it('changes the password when the current one is right', async () => {
        const email = await signedIn('ok');
        const next = 'another good password';

        expect(
            await redirectOf(() =>
                changePasswordAction(
                    form({
                        currentPassword: PASSWORD,
                        newPassword: next,
                        confirmPassword: next,
                    }),
                ),
            ),
        ).toBe('/settings/password/success');

        jar.clear();
        expect(await redirectOf(() => loginAction(form({ email, password: next })))).toBe(
            '/dashboard',
        );
    });

    it('refuses a wrong current password', async () => {
        await signedIn('bad');

        expect(
            await redirectOf(() =>
                changePasswordAction(
                    form({
                        currentPassword: 'not it',
                        newPassword: 'a good new one',
                        confirmPassword: 'a good new one',
                    }),
                ),
            ),
        ).toBe('/settings/password?error=invalid_current');
    });

    it('refuses a short new password', async () => {
        await signedIn('short');

        expect(
            await redirectOf(() =>
                changePasswordAction(
                    form({ currentPassword: PASSWORD, newPassword: 'abc', confirmPassword: 'abc' }),
                ),
            ),
        ).toBe('/settings/password?error=password_too_short');
    });

    it('refuses a mismatched confirmation', async () => {
        await signedIn('mismatch');

        expect(
            await redirectOf(() =>
                changePasswordAction(
                    form({
                        currentPassword: PASSWORD,
                        newPassword: 'a good new one',
                        confirmPassword: 'a different one',
                    }),
                ),
            ),
        ).toBe('/settings/password?error=passwords_dont_match');
    });

    it('sends a signed-out caller to the login page', async () => {
        jar.clear();

        expect(
            await redirectOf(() =>
                changePasswordAction(
                    form({
                        currentPassword: PASSWORD,
                        newPassword: 'a good new one',
                        confirmPassword: 'a good new one',
                    }),
                ),
            ),
        ).toBe('/login');
    });
});

describe('logoutAction', () => {
    it('clears the session and sends the member home', async () => {
        const member = await sandbox.createUser();

        const { createSession } = await import('../../../lib/auth/session');
        await createSession(member.userId);

        expect(jar.has('skillpath_session')).toBe(true);

        expect(await redirectOf(() => logoutAction())).toBe('/');
        expect(jar.has('skillpath_session')).toBe(false);
    });
});
