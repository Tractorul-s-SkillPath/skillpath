/**
 * Edge middleware — the redirect convenience, and the session refresh under it.
 *
 * Stories: SP-010, SP-012
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE USED TO PIN, AND WHY THAT CASE IS GONE.
 * ---------------------------------------------------------------------------
 *
 * The old version's most important test asserted that a GARBAGE cookie was let
 * through. That was a real trade-off, honestly recorded: the session was a
 * cookie of ours signed with an HMAC, the HMAC needed node:crypto, and the Edge
 * runtime has none — so middleware could check only that a cookie was PRESENT,
 * and a forged one was rejected one hop later by assertAuth().
 *
 * Supabase Auth removes the constraint rather than the check. `getUser()` asks
 * the auth server to verify the token, which works on the Edge, so a forged
 * cookie is now rejected HERE. The test that pinned the hole has been replaced
 * by one that pins its absence — and the note stays, because somebody reading
 * `getUser()` and thinking "getSession() would save a round trip" needs to find
 * out from a red test that getSession() believes whatever the browser sent.
 *
 * Middleware is STILL not the boundary (ARCHITECTURE §5a). assertAuth() and
 * assertAdmin() are, because a Server Action is a public endpoint and no
 * middleware on the page it lives on protects it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * One switch the tests flip, read by the mock below.
 *
 * `getUser()` is what middleware calls, so a "signed in" case is this set to a
 * user object and a "signed out" case is this set to null — including the
 * forged-cookie case, because a token that fails verification comes back from
 * Supabase as no user rather than as an exception.
 */
let authUser: { id: string } | null = null;

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
        auth: {
            getUser: async () => ({ data: { user: authUser }, error: null }),
        },
    })),
}));

const { middleware } = await import('../middleware');

const PROTECTED = ['/dashboard', '/profile', '/assessments', '/plan', '/admin'];
const PUBLIC = ['/', '/login', '/register', '/success', '/forgot-password'];

function request(path: string): NextRequest {
    return new NextRequest(new URL(path, 'https://skillpath.test'));
}

/** Where a response sends the browser, or null when it lets the request through. */
function redirectedTo(response: Response): string | null {
    if (response.status < 300 || response.status >= 400) return null;

    const location = response.headers.get('location');
    return location ? new URL(location).pathname + new URL(location).search : null;
}

beforeEach(() => {
    authUser = null;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

describe('signed out', () => {
    it.each(PROTECTED)('bounces %s to /login', async (path) => {
        expect(redirectedTo(await middleware(request(path)))).toBe(
            `/login?next=${encodeURIComponent(path)}`,
        );
    });

    it('bounces a nested protected path too', async () => {
        // `path.startsWith(`${p}/`)` rather than a bare startsWith: the run
        // screen and the results page live under /assessments/:id.
        expect(redirectedTo(await middleware(request('/assessments/12/results')))).toContain(
            '/login',
        );
    });

    it.each(PUBLIC)('lets %s through', async (path) => {
        expect(redirectedTo(await middleware(request(path)))).toBeNull();
    });

    it('does not treat a path that merely starts with a protected word as protected', async () => {
        // /planning is not /plan. The guard is an exact match or a `/` after
        // the prefix, and a bare startsWith would bounce this.
        expect(redirectedTo(await middleware(request('/planning')))).toBeNull();
    });

    it('carries the query string into `next`, not just the path', async () => {
        // Asserted as a parsed parameter rather than as the whole URL, because
        // the redirect is built by cloning the incoming nextUrl — so the
        // original `?category=3` is still on it and `next` is appended
        // alongside. That is untidy and harmless, and pinning the exact string
        // would make this test fail the day somebody tidies it.
        //
        // What matters is that `next` round-trips the query, so signing in
        // returns the member to /assessments?category=3 and not to a bare
        // /assessments that has forgotten which category they picked.
        const to = redirectedTo(await middleware(request('/assessments?category=3')))!;

        expect(new URL(to, 'https://skillpath.test').searchParams.get('next')).toBe(
            '/assessments?category=3',
        );
    });
});

describe('signed in', () => {
    beforeEach(() => {
        authUser = { id: '00000000-0000-4000-8000-000000000007' };
    });

    it.each(PROTECTED)('lets %s through', async (path) => {
        expect(redirectedTo(await middleware(request(path)))).toBeNull();
    });

    it('marks protected pages no-store, so Back cannot show them after sign-out', async () => {
        // SP-010 AC3. Without this the browser re-renders a cached /profile
        // from bfcache after signing out, which looks exactly like still being
        // signed in.
        const response = await middleware(request('/profile'));

        expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });

    it('does not send an admin opening /login anywhere', async () => {
        // Deliberately NOT handled here. The redirect would have to go
        // somewhere unconditionally and /dashboard is wrong for an admin; the
        // role lives in public.users, which this layer will not read on every
        // request. app/(auth)/layout.tsx does it where the role is available.
        expect(redirectedTo(await middleware(request('/login')))).toBeNull();
    });
});

describe('a token that does not verify', () => {
    it('is bounced HERE, not one hop later', async () => {
        // The case that replaced "a garbage cookie is let through".
        //
        // A forged or expired token makes getUser() return no user, so this is
        // the same code path as signed-out — which is the point: middleware no
        // longer has to take the browser's word for it. If somebody swaps
        // getUser() for getSession(), the decoded-but-unverified payload comes
        // back as a user and this test goes red.
        authUser = null;

        expect(redirectedTo(await middleware(request('/plan')))).toBe(
            `/login?next=${encodeURIComponent('/plan')}`,
        );
    });
});
