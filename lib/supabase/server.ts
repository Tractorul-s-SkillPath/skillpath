/**
 * Server client — anon key + the user's cookie session. THE DEFAULT.
 *
 * Story: SP-002
 *
 * Sketch: createServerClient from @supabase/ssr, wired to next/headers cookies.
 * Use it for everything a user does as themselves; RLS applies, which is the
 * point. Called per request — never module-level, cookies are request-scoped.
 */
