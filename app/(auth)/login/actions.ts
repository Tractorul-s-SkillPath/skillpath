/**
 * Sign in.
 *
 * Stories: SP-010, SP-012
 *
 * Supabase Auth verifies the password and sets the session cookies; the cookie
 * write lands because a Server Action CAN set cookies, which is the half of
 * `lib/supabase/server.ts`'s `setAll` that is not swallowed.
 *
 * Where it sends you afterwards is read from `public.users.role`, not from the
 * form and not from the token. That is the same rule getCurrentUser() follows,
 * and e2e/helpers/member.ts asserts it: every sign-in in the suite states which
 * role it believes it is signing in as, so a build that stopped reading the
 * column fails there rather than deep inside a page.
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase/server';

/**
 * `next` comes from the query string, so it is attacker-controlled: without
 * these four lines `/login?next=https://elsewhere.example` is an open redirect
 * wearing our domain. Only a path on this site is allowed — `//host` and a
 * backslash are the two ways a value that starts with `/` can still leave.
 */
function safeNext(formData: FormData): string | null {
    const next = String(formData.get('next') ?? '').trim();

    if (!next.startsWith('/')) return null;
    if (next.startsWith('//')) return null;
    if (next.includes('\\')) return null;

    return next;
}

export async function loginAction(formData: FormData): Promise<void> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
        redirect('/login?error=invalid');
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // One message for a bad address and a bad password alike. Telling them
    // apart would confirm which addresses have accounts.
    if (error || !data.user) {
        console.error('[auth] sign-in failed:', error?.message);
        redirect('/login?error=invalid');
    }

    // The account can be disabled without the credentials changing (SP-014), so
    // the profile row decides whether this session is allowed to continue —
    // and signOut() runs first, or a disabled member keeps a usable cookie and
    // only the redirect stops them.
    const { data: profile } = await supabase
        .from('users')
        .select('role, status')
        .eq('user_id', data.user.id)
        .maybeSingle();

    if (!profile) {
        console.error('[auth] no profile row for', data.user.id);
        await supabase.auth.signOut();
        redirect('/login?error=unavailable');
    }

    if (profile.status !== 'active') {
        await supabase.auth.signOut();
        redirect('/login?error=disabled');
    }

    revalidatePath('/', 'layout');

    redirect(safeNext(formData) ?? (profile.role === 'admin' ? '/admin' : '/dashboard'));
}
