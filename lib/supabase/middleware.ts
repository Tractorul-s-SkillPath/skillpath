/**
 * Session refresh helper for middleware.ts.
 *
 * Stories: SP-002, SP-012
 *
 * Sketch: createServerClient with the request/response cookie adapters, call
 * getUser() to refresh, and return BOTH the user and the response whose cookies
 * were rewritten. Returning only the user loses the refreshed session — that is
 * the classic @supabase/ssr bug.
 */
