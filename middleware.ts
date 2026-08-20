/**
 * Edge middleware — session refresh + redirect convenience.
 *
 * Layer: EDGE. NOT a security boundary (ARCHITECTURE §5a) — RLS is.
 * Stories: SP-010, SP-012, SP-014
 *
 * Sketch
 *  - calls lib/supabase/middleware.ts to refresh the auth cookie on every request
 *  - anonymous + protected route  -> redirect /login?next=<path>
 *  - authenticated + /login|/register -> redirect /dashboard
 *  - sets no-store on protected responses so Back does not show cached
 *    content after logout (SP-010 AC3)
 *  - matcher skips _next, static assets and images
 *
 * Deliberately does NOT check role. /admin is guarded by assertAdmin() in the
 * layout AND by RLS; a redirect here would be a third, weakest copy.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Deocamdată, lăsăm toate rutele să funcționeze normal
  return NextResponse.next();
}

// Această configurare îi spune pe ce rute să ruleze middleware-ul
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};