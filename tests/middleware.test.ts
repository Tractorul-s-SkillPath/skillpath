/**
 * Tests for middleware.ts.
 *
 * Story: SP-012, SP-010
 *
 * Cases
 *  - anonymous + /dashboard -> redirect /login with ?next preserved
 *  - anonymous + /admin     -> redirect /login
 *  - authenticated + /login -> redirect to the role's home
 *  - the refreshed auth cookie is present on the returned response (the classic
 *    @supabase/ssr mistake is returning the user but dropping the response)
 *  - protected responses carry no-store, so Back after logout shows nothing (SP-010 AC3)
 *  - static assets and _next are not matched
 */
