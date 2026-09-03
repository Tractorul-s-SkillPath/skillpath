/**
 * Test identities, and the sign-in every spec starts with.
 *
 * Story: SP-101
 *
 * Extracted when a second spec needed the same thing and copied it instead.
 * The two copies had already drifted — one of them had quietly lost the
 * E2E_CLEAN hint from its teardown log — which is the whole argument for this
 * file existing before there is a third.
 */

import { expect, type Page } from '@playwright/test';

export interface Member {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

/**
 * The admin `scripts/seed-users.mjs` writes. NOT created by the spec that uses
 * it: `loginAction` refuses to register an admin through the form
 * (`/register?error=manager_approval_required`), by design — an account that
 * can read the answer key is not something a signup form hands out. So the
 * admin has to be seeded, and a project that was never seeded fails here rather
 * than eight steps later.
 */
export const SEEDED_ADMIN = {
    email: 'admin@skillpath.test',
    password: 'skillpath123',
} as const;

/**
 * Unique on BOTH axes, which is not belt-and-braces: `loginAction` rejects a
 * duplicate email *and* a duplicate first-name/last-name pair. A fixed name
 * passes once and then redirects to /register?error=name_already_exists
 * forever after — a second run that fails for a reason unrelated to the code.
 *
 * `firstName` varies the email's local part too, so two specs in one run are
 * still telling apart in the users table. The runId lives in `lastName`
 * regardless: that is the half that has to be unique, and putting it only in
 * the first name would make two specs with the same surname collide.
 *
 * Minted inside the test rather than at import time, so a RETRY registers
 * somebody new. Playwright normally discards a worker after a failure and the
 * fresh one would re-import this module anyway — but `retries: 1` is on in CI
 * and a test that only works because of how the runner recycles processes is
 * one step from failing for a reason nobody can see.
 */
/**
 * The domain the journey registers under. NOT `skillpath.test`, and that is not
 * a style preference.
 *
 * Supabase Auth validates the address on the public sign-up path and rejects
 * reserved TLDs:
 *
 *     [auth] sign-up failed: 400 Email address "e2e-…@skillpath.test" is invalid
 *
 * `.test` is reserved by RFC 2606 and can never be delivered to, so the
 * validator refuses it. The seeded accounts elsewhere in this suite keep
 * `@skillpath.test` and still work, because they are created through
 * `auth.admin.createUser`, which is the admin API and skips that validation —
 * which is exactly why this failure showed up only for the browser journey.
 *
 * `example.com` is IANA's documentation domain: a real registrable TLD, so it
 * passes validation, and permanently reserved, so a stray confirmation mail can
 * never reach a real person. Override it if this project's validator ever
 * disagrees — nothing else in the suite depends on the domain.
 */
const E2E_EMAIL_DOMAIN = process.env.E2E_EMAIL_DOMAIN ?? 'example.com';

/**
 * The cookies that actually hold the Supabase session — all of them, and
 * nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A REGEX AND NOT `name.includes('auth-token')`.
 * ---------------------------------------------------------------------------
 *
 * `includes` also matches `sb-<ref>-auth-token-code-verifier`, the PKCE cookie,
 * which is not the session. A step that picked THAT one and corrupted it left
 * the real session untouched, so the request went through and the assertion
 * failed — but only sometimes, because `context.cookies()` does not promise an
 * order. It passed under `npm run test:e2e` and failed under
 * `test:e2e:dev` on the same commit, which is the signature of a test picking
 * one of several matches at random.
 *
 * Anchoring on the end of the name excludes the verifier. Allowing a `.N`
 * suffix keeps the chunks: @supabase/ssr splits a large session across
 * `…auth-token.0`, `…auth-token.1`, and a caller that took only the first would
 * be back to corrupting part of a value that still reassembles.
 *
 * Returns an array, deliberately. Every caller must handle "more than one", and
 * a helper returning a single cookie would put the same bug back.
 */
export function sessionCookies<T extends { name: string }>(cookies: readonly T[]): T[] {
    return cookies.filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
}

export function newMember(firstName = 'E2E'): Member {
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    return {
        firstName,
        lastName: `Runner-${runId}`,
        email: `${firstName.toLowerCase()}-${runId}@${E2E_EMAIL_DOMAIN}`,
        password: 'e2e-password-1234',
    };
}

/**
 * Register through the form.
 *
 * Ends on /success and NOT signed in — `loginAction`'s create branch redirects
 * there and never calls createSession. Asserted rather than assumed, because if
 * it ever changes, every `signIn` after it starts passing for the wrong reason.
 */
export async function register(page: Page, member: Member): Promise<void> {
    await page.goto('/register');

    await page.fill('input[name="firstName"]', member.firstName);
    await page.fill('input[name="lastName"]', member.lastName);
    await page.fill('input[name="email"]', member.email);
    await page.fill('input[name="password"]', member.password);

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/success$/);
}

/**
 * Sign in and land where the ROLE says, not where the caller hoped.
 *
 * `lands` is required rather than defaulted: the redirect is
 * `user.role === 'admin' ? '/admin' : '/dashboard'`, read from the database row
 * and not from anything the browser sent (current-user.ts:238). Passing it in
 * makes every call site state which role it believes it is signing in as, so a
 * build that stopped reading the column fails here instead of somewhere deep in
 * a page that renders differently for the two.
 */
export async function signIn(
    page: Page,
    credentials: { email: string; password: string },
    lands: RegExp,
): Promise<void> {
    await page.goto('/login');

    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(lands);
}
