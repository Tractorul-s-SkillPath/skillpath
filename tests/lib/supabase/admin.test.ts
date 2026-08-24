/**
 * Tests for lib/supabase/admin.ts — the bundle boundary.
 *
 * Story: SP-002
 *
 * Cases
 *  - the module's first import is 'server-only'
 *  - no file under app/ or components/ imports lib/supabase/admin (a static
 *    scan of the source tree — cheap, and it catches the mistake at the moment
 *    it is made rather than at build time)
 *  - SUPABASE_SERVICE_ROLE_KEY is never referenced outside lib/supabase/admin.ts
 *    and scripts/
 *
 * SP-002 AC2 ("importing it into a client component fails the build") is proven
 * by CI running `next build`; this file is the fast feedback loop.
 */
