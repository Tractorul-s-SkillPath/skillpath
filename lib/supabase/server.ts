/**
 * Server client — anon key + the user's cookie session. THE DEFAULT.
 *
 * Story: SP-002
 *
 * Sketch: createServerClient from @supabase/ssr, wired to next/headers cookies.
 * Use it for everything a user does as themselves; RLS applies, which is the
 * point. Called per request — never module-level, cookies are request-scoped.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() { // <--- Asigură-te că ai export aici!
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    );
}
