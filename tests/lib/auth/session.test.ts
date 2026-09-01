/**
 * Tests for lib/auth/session.ts.
 *
 * Story: SP-121 (the gap), SP-012, SP-014
 *
 * This file is the reason lib/auth read 26% and session.ts read 5.71%. It is
 * also the most security-sensitive module in the project: the signature over
 * the cookie is the only thing standing between a student and an admin session.
 * The header of the source says what it replaced — `{"userId":"usr_123",
 * "role":"admin"}` as plain JSON, editable by anyone with dev tools open.
 *
 * So the cases below are weighted towards FORGERY, not round-tripping. A test
 * that only proves createSession -> readSession returns the same id would pass
 * against an implementation with no signature at all.
 *
 * `cookies()` from next/headers is faked with a real Map rather than a stub per
 * assertion, because the round trip is the behaviour: sign here, verify there,
 * through whatever the cookie jar actually stored.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'skillpath_session';
const SECRET = 'test-secret-at-least-thirty-two-characters-long';

/** The jar the faked next/headers hands out. Replaced before every test. */
let jar: Map<string, string>;
/** Options passed to the last cookieStore.set() — the flags are behaviour. */
let lastOptions: Record<string, unknown> | undefined;

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) => {
            const value = jar.get(name);
            return value === undefined ? undefined : { name, value };
        },
        set: (name: string, value: string, options?: Record<string, unknown>) => {
            jar.set(name, value);
            lastOptions = options;
        },
        delete: (name: string) => {
            jar.delete(name);
        },
    })),
}));

/**
 * Imported fresh per test because secret() reads process.env at call time and
 * several tests below change SESSION_SECRET. A module-level import would also
 * work today, but pins the tests to that implementation detail.
 */
async function subject() {
    return import('../../../lib/auth/session');
}

beforeEach(() => {
    jar = new Map();
    lastOptions = undefined;
    process.env.SESSION_SECRET = SECRET;
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('secret', () => {
    it.each([
        ['missing', undefined],
        ['too short to be an HMAC key', 'short'],
        ['empty', ''],
    ])('refuses to sign anything when SESSION_SECRET is %s', async (_label, value) => {
        // Failing loudly matters more than usual here: a default or a silently
        // generated key would produce cookies that verify locally and fail on
        // every other instance, which looks like random sign-outs.
        if (value === undefined) delete process.env.SESSION_SECRET;
        else process.env.SESSION_SECRET = value;

        const { createSession } = await subject();

        await expect(createSession(7)).rejects.toThrow(/SESSION_SECRET/);
    });

    it('names the fix in the message, not just the problem', async () => {
        delete process.env.SESSION_SECRET;
        const { createSession } = await subject();

        await expect(createSession(7)).rejects.toThrow(/\.env\.local/);
    });
});

describe('createSession', () => {
    it('round-trips the user id', async () => {
        const { createSession, readSession } = await subject();

        await createSession(42);

        await expect(readSession()).resolves.toBe(42);
    });

    it('writes a signed value, not readable JSON', async () => {
        // The bug this replaced: the id and role were plain JSON in the cookie.
        const { createSession } = await subject();

        await createSession(42);
        const raw = jar.get(COOKIE_NAME) ?? '';

        expect(raw).not.toContain('userId');
        expect(raw).toContain('.');
        expect(raw.split('.')).toHaveLength(2);
    });

    it('sets the flags that keep the cookie out of reach of scripts and CSRF', async () => {
        const { createSession } = await subject();

        await createSession(42);

        expect(lastOptions).toMatchObject({
            httpOnly: true,   // XSS cannot read it
            sameSite: 'lax',  // a cross-site POST does not carry it
            path: '/',
        });
    });

    it('sets an expiry rather than a session cookie', async () => {
        // A session cookie would sign everyone out when they close the browser,
        // and — more to the point — the payload's own expiry is what readSession
        // enforces. The two have to agree.
        const { createSession } = await subject();

        await createSession(42);

        expect(lastOptions?.maxAge).toBe(60 * 60 * 24 * 7);
    });
});

describe('readSession', () => {
    it('returns null when there is no cookie at all', async () => {
        const { readSession } = await subject();

        await expect(readSession()).resolves.toBeNull();
    });

    it.each([
        ['empty', ''],
        ['no separator', 'notasignedcookie'],
        ['a leading separator and no body', '.signature'],
        ['a body and no signature', 'eyJ1c2VySWQiOjF9.'],
        ['not base64url', '!!!!.!!!!'],
    ])('treats a malformed cookie (%s) as signed out rather than throwing', async (_label, raw) => {
        // A crash here is a 500 on every page, including the login page that
        // would let someone recover.
        jar.set(COOKIE_NAME, raw);
        const { readSession } = await subject();

        await expect(readSession()).resolves.toBeNull();
    });

    it('rejects a payload whose signature does not match it', async () => {
        // THE test. Take a legitimately signed cookie, edit the payload to
        // claim a different user, keep the signature. This is what someone with
        // dev tools open actually does.
        const { createSession, readSession } = await subject();

        await createSession(1);
        const [, signature] = (jar.get(COOKIE_NAME) ?? '').split('.');

        const forged = Buffer.from(JSON.stringify({ userId: 999, expiresAt: Date.now() + 60_000 }))
            .toString('base64url');

        jar.set(COOKIE_NAME, `${forged}.${signature}`);

        await expect(readSession()).resolves.toBeNull();
    });

    it('rejects a cookie signed with a different secret', async () => {
        // Rotating SESSION_SECRET must sign everyone out, not let old cookies
        // through. Same shape as an attacker signing with a guessed key.
        const first = await subject();
        await first.createSession(42);
        const signedElsewhere = jar.get(COOKIE_NAME) ?? '';

        vi.resetModules();
        process.env.SESSION_SECRET = 'a-completely-different-secret-32-chars';
        const second = await subject();

        jar.set(COOKIE_NAME, signedElsewhere);

        await expect(second.readSession()).resolves.toBeNull();
    });

    it('rejects an unsigned payload appended to nothing', async () => {
        // The naive forgery: build the payload, skip the signature entirely.
        const body = Buffer.from(JSON.stringify({ userId: 999, expiresAt: Date.now() + 60_000 }))
            .toString('base64url');

        jar.set(COOKIE_NAME, `${body}.`);
        const { readSession } = await subject();

        await expect(readSession()).resolves.toBeNull();
    });

    it('rejects a correctly signed but expired cookie', async () => {
        // The signature is valid; only the clock rejects this one. Without the
        // expiry check a leaked cookie is good forever.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

        const { createSession, readSession } = await subject();
        await createSession(42);

        vi.setSystemTime(new Date('2026-01-09T00:00:00Z')); // eight days later

        await expect(readSession()).resolves.toBeNull();
    });

    it('accepts a cookie that has not quite expired', async () => {
        // The other side of the boundary, so the expiry test above is not
        // passing for some unrelated reason.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

        const { createSession, readSession } = await subject();
        await createSession(42);

        vi.setSystemTime(new Date('2026-01-07T23:00:00Z')); // just inside seven days

        await expect(readSession()).resolves.toBe(42);
    });

    /**
     * Payloads are written as raw JSON TEXT, not as objects passed through
     * JSON.stringify, and that is not stylistic.
     *
     * `JSON.stringify({ userId: NaN })` emits `{"userId":null}` — NaN and
     * Infinity have no JSON representation. Written as objects, the two
     * non-finite cases below silently become the "no id at all" case, and pass
     * against an implementation with no Number.isFinite check at all. (They
     * did, on the first draft of this file; a mutation run is what showed it.)
     *
     * `1e999` in the text parses to Infinity with typeof 'number', which is the
     * only way that guard is reachable — and it is reachable, because what
     * arrives here is a string somebody else may have written.
     */
    it.each([
        ['a string id', '{"userId":"999","expiresAt":32503680000000}'],
        ['no id at all', '{"expiresAt":32503680000000}'],
        ['a null id', '{"userId":null,"expiresAt":32503680000000}'],
        ['an infinite id', '{"userId":1e999,"expiresAt":32503680000000}'],
        ['a negative infinite id', '{"userId":-1e999,"expiresAt":32503680000000}'],
        ['no expiry', '{"userId":42}'],
        ['a string expiry', '{"userId":42,"expiresAt":"32503680000000"}'],
        ['an array instead of an object', '[42,32503680000000]'],
        ['a bare number', '42'],
    ])('rejects a validly signed cookie carrying %s', async (_label, json) => {
        // Signed by us, so the HMAC passes — these get through unless the
        // payload itself is checked. A string userId reaching a repository is
        // a type error at best and a filter injection at worst.
        vi.resetModules();
        const { createHmac } = await import('node:crypto');

        const body = Buffer.from(json).toString('base64url');
        const signature = createHmac('sha256', SECRET).update(body).digest('base64url');

        jar.set(COOKIE_NAME, `${body}.${signature}`);
        const { readSession } = await subject();

        await expect(readSession()).resolves.toBeNull();
    });

    it('survives a validly signed body that is not JSON at all', async () => {
        // The only way to reach the try/catch: the signature check runs first,
        // so an unsigned garbage body is rejected before anything is parsed.
        // Signed garbage is what a rotated-but-reused secret, or a truncated
        // cookie, actually looks like — and an uncaught SyntaxError here is a
        // 500 on every page including /login.
        vi.resetModules();
        const { createHmac } = await import('node:crypto');

        const body = Buffer.from('not json, just text').toString('base64url');
        const signature = createHmac('sha256', SECRET).update(body).digest('base64url');

        jar.set(COOKIE_NAME, `${body}.${signature}`);
        const { readSession } = await subject();

        await expect(readSession()).resolves.toBeNull();
    });

    it('reads the id from the last separator, so a body containing one still verifies', async () => {
        // base64url has no '.', but the parser splits on the LAST one and this
        // pins that choice — splitting on the first would break any future
        // encoding that produces one.
        const { createSession, readSession } = await subject();

        await createSession(42);
        const raw = jar.get(COOKIE_NAME) ?? '';

        expect(raw.lastIndexOf('.')).toBe(raw.indexOf('.'));
        await expect(readSession()).resolves.toBe(42);
    });
});

describe('destroySession', () => {
    it('removes the cookie', async () => {
        const { createSession, destroySession, readSession } = await subject();

        await createSession(42);
        await destroySession();

        expect(jar.has(COOKIE_NAME)).toBe(false);
        await expect(readSession()).resolves.toBeNull();
    });

    it('is safe to call when nobody is signed in', async () => {
        // Logout is reachable without a session; it must not 500.
        const { destroySession } = await subject();

        await expect(destroySession()).resolves.toBeUndefined();
    });
});
