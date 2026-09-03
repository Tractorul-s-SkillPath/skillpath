/**
 * Server client — anon key + the user's cookie session. THE DEFAULT.
 *
 * Story: SP-002
 *
 * Called per request, never at module level: cookies are request-scoped.
 *
 * The `<Database>` generic is load-bearing. Without it `createServerClient`
 * returns `SupabaseClient<any>`, and because `any` satisfies the
 * `SupabaseClient<Database>` annotation every repository declares, the whole
 * repository layer type-checked against nothing — which is why the reads used
 * to need `data as unknown as Array<...>` to compile. With the generic in
 * place, column names and row shapes are checked for real and those casts come
 * out.
 */
import 'server-only'
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireEnv } from './env';
import type { Database } from './database.types';

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        {
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
