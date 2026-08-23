/**
 * Edge middleware — redirect convenience only.
 *
 * Layer: EDGE. NOT a security boundary (ARCHITECTURE §5a).
 * Stories: SP-010, SP-012
 *
 * This checks only that a session cookie is PRESENT. It does not verify the
 * signature, because middleware runs on the Edge runtime and the HMAC needs
 * node:crypto. That is fine, and deliberate: a forged cookie gets past this
 * redirect and then fails verification in assertAuth() on the page itself,
 * which is where the real check has always been.
 *
 * The failure mode to keep in mind: a tampered cookie lets someone reach the
 * page shell and get bounced by assertAuth, rather than being bounced here.
 * Same destination, one more hop.
 */

import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'skillpath_session';

const PROTECTED = ['/dashboard', '/profile', '/assessments', '/plan', '/admin'];

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

    if (!hasCookie && isProtected) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        // Read by the login form, which carries it through as a hidden field so
        // signing in returns you to the page you were actually going to.
        url.searchParams.set('next', `${path}${request.nextUrl.search}`);
        return NextResponse.redirect(url);
    }

    // Sending an already-signed-in member away from /login and /register used
    // to happen here, and it went to /dashboard unconditionally — so an admin
    // who opened /login landed on a student page. Middleware cannot do better:
    // the role lives in the database and the Edge runtime has no client for it.
    // app/(auth)/layout.tsx does the same redirect one layer in, where the role
    // is readable, and each role reaches its own home.

    const response = NextResponse.next();

    // Back must not show a cached profile after signing out (SP-010 AC3).
    if (isProtected) {
        response.headers.set('Cache-Control', 'no-store, max-age=0');
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
