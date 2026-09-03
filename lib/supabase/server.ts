/**
 * The two server-side Supabase clients, and the line between them.
 *
 * Story: SP-002, SP-004
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO, AND WHY THE DEFAULT ONE CHANGED KEY
 * ---------------------------------------------------------------------------
 *
 * This file used to export one client, built on SUPABASE_SERVICE_ROLE_KEY. That
 * was survivable while RLS was off on every table — the anon key could read and
 * write everything anyway, so the service role bought nothing and cost nothing.
 *
 * It stopped being survivable the moment 20260902204628_securitate_rls.sql
 * landed. Every policy in that migration is written against `auth.uid()`, and
 * the service role does not have one: it bypasses RLS entirely. So a single
 * service-role client would have made the whole policy set decorative — the
 * migration would be in the repository, enabled on the tables, and enforced
 * against nobody, which is worse than not having it, because the code reads as
 * though the boundary is there.
 *
 * So:
 *
 *   createClient()         anon key + the caller's session cookie. THE DEFAULT.
 *                          `auth.uid()` is the signed-in user, so every policy
 *                          applies and a query can only reach that user's rows.
 *
 *   createServiceClient()  service-role key, no session. Bypasses RLS.
 *                          For the two jobs RLS deliberately makes impossible.
 *
 * Both are called per request and never at module level: cookies are
 * request-scoped, and a module-level client would leak one user's session into
 * the next request.
 *
 * The `<Database>` generic is load-bearing on both. Without it
 * `createServerClient` returns `SupabaseClient<any>`, and because `any`
 * satisfies the `SupabaseClient<Database>` annotation every repository
 * declares, the whole repository layer type-checks against nothing.
 */
import 'server-only'
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireEnv } from './env';
import type { Database } from './database.types';

/**
 * The default client. Anon key, plus whatever session the request carries.
 *
 * Reads and writes through this are subject to RLS, which is the point: a bug
 * in a repository query can no longer return another member's rows, because the
 * database refuses them rather than trusting the `.eq('user_id', …)` the query
 * happened to include.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        {
            // ---------------------------------------------------------------
            // httpOnly: true, OVERRIDING THE LIBRARY DEFAULT OF false.
            // ---------------------------------------------------------------
            //
            // @supabase/ssr ships `httpOnly: false` (see its
            // DEFAULT_COOKIE_OPTIONS) because the usual setup also runs a
            // browser Supabase client, which has to read the token out of the
            // cookie with JavaScript.
            //
            // This application has no browser client — every query goes through
            // a Server Component or a Server Action, and lib/supabase/server.ts
            // imports 'server-only' so it cannot be pulled into a bundle. So
            // nothing needs to read this cookie from script, and leaving it
            // readable would hand any XSS a live session.
            //
            // The cookie it replaced was httpOnly, and baseline-journey.spec.ts
            // asserted so. Accepting the default here would have been a quiet
            // downgrade with the test that caught it deleted in the same change.
            cookieOptions: {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options),
                        );
                    } catch {
                        // Called from a Server Component, which cannot set
                        // cookies. Middleware refreshes the session instead.
                    }
                },
            },
        },
    );
}

/**
 * The escape hatch. Service role, so RLS does not apply.
 *
 * ---------------------------------------------------------------------------
 * EVERY CALLER MUST HAVE PASSED assertAdmin() FIRST, OR BE THE GRADER.
 * ---------------------------------------------------------------------------
 *
 * There are exactly two reasons to reach for this, and both are in
 * ARCHITECTURE §5c:
 *
 *  1. **The question bank.** `answers.is_correct` is the answer key. The RLS
 *     policy on `answers` is `for select using (true)`, so a student's client
 *     CAN read that column — the protection is that no student-facing query
 *     ever selects it (question.service strips it). Admin screens that write
 *     the bank need to read and write it, and they run behind assertAdmin.
 *
 *  2. **Cross-user aggregates.** The admin overview counts every member and
 *     every assessment. `auth.uid()` policies make that unreachable by design —
 *     there is no admin policy in the RLS migration, deliberately, because an
 *     `is_admin()` policy would put the role check in two places and let them
 *     drift. The role check lives in assertAdmin(), once.
 *
 * Anything that is about ONE member's own rows must NOT use this. That is what
 * createClient() is for, and routing it here would silently reintroduce the
 * problem this file was split to fix.
 *
 * No cookies are attached on purpose: a service-role client with a session
 * would be ambiguous about which identity it is acting as, and the answer is
 * "none — it is acting as the system".
 */
export function createServiceClient() {
    return createSupabaseClient<Database>(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
}
