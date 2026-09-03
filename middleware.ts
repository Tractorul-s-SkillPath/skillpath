/**
 * Edge middleware — session refresh, and a redirect convenience on top of it.
 *
 * Layer: EDGE. Stories: SP-010, SP-012
 *
 * ---------------------------------------------------------------------------
 * IT NOW HAS A SECOND JOB, AND THE SECOND ONE IS THE LOAD-BEARING ONE.
 * ---------------------------------------------------------------------------
 *
 * Supabase access tokens are short-lived. Something has to spend the refresh
 * token and write the new pair back to the browser, and in the App Router that
 * has to happen here: a Server Component cannot set cookies, so
 * `lib/supabase/server.ts` swallows the write (see its `setAll`). Without this
 * middleware a member is signed out the moment their first token expires, which
 * looks like a random logout an hour into a session.
 *
 * `supabase.auth.getUser()` below is what performs that refresh. It is called
 * for its side effect as much as for its answer, so do not "optimise" it away
 * on unprotected paths.
 *
 * ---------------------------------------------------------------------------
 * STILL NOT A SECURITY BOUNDARY (ARCHITECTURE §5a).
 * ---------------------------------------------------------------------------
 *
 * The redirect below is a convenience: it saves a signed-out visitor from
 * rendering a page shell only to be bounced by assertAuth(). The real check is
 * assertAuth()/assertAdmin() on the page and in every Server Action, because a
 * Server Action is a public endpoint that middleware protecting its page does
 * nothing for.
 *
 * What DID improve: this used to check only that a cookie named
 * `skillpath_session` was PRESENT, without verifying anything, because the old
 * HMAC needed node:crypto and the Edge runtime has none. getUser() verifies the
 * token against the auth server, so a forged cookie is now rejected here too —
 * one hop earlier than before, rather than one hop later.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/profile', '/assessments', '/plan', '/admin'];

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Cookies set during the refresh have to reach BOTH the browser and any
    // handler further down this request, so each write goes onto the request
    // (for the former) and onto a response rebuilt from it (for the latter).
    // Rebuilding is why `response` is reassigned rather than created once.
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            // Must match lib/supabase/server.ts exactly — see the note there.
            // A refresh written here with different flags than the sign-in
            // wrote would replace an httpOnly cookie with a script-readable
            // one the first time a token rotated, which is the same hole
            // arriving an hour late.
            cookieOptions: {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            },
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    );

                    response = NextResponse.next({ request });

                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

    if (!user && isProtected) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        // Read by the login form, which carries it through as a hidden field so
        // signing in returns you to the page you were actually going to.
        url.searchParams.set('next', `${path}${request.nextUrl.search}`);
        return NextResponse.redirect(url);
    }

    // Sending an already-signed-in member away from /login and /register does
    // NOT happen here, and the reason survived the move to Supabase Auth: it
    // would have to go somewhere unconditionally, and /dashboard is wrong for
    // an admin. The role lives in `public.users` and reading it needs a
    // database round trip this layer should not be making on every request.
    // app/(auth)/layout.tsx does it one layer in, where the role is readable.

    // Back must not show a cached profile after signing out (SP-010 AC3).
    if (isProtected) {
        response.headers.set('Cache-Control', 'no-store, max-age=0');
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
