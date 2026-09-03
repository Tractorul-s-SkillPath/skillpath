/**
 * Registration server action.
 *
 * Layer: ACTION
 * Story: SP-011
 *
 * There is no separate sign-up path: loginAction creates the account when the
 * email has never been seen, so registering and signing in are the same call
 * with different fields posted. This wrapper exists so the register page
 * imports a verb that matches what the user thinks they are doing, and so the
 * two can diverge later without touching the page.
 *
 * What it inherits from that action, and what the team has agreed to:
 *  - no password is verified. The field is collected and dropped (see the
 *    header of lib/auth/current-user.ts)
 *  - registering with an email that already exists signs you into that account
 *    rather than failing. There is no credential, so there is nothing to get
 *    wrong — but it does mean "email already taken" is not a state that exists
 *  - the role dropdown is honoured only when the account is created; after
 *    that role comes from the database and the dropdown does nothing
 *
 * Test: tests/app/(auth)/register/actions.test.ts
 */
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

export async function registerAction(formData: FormData): Promise<void> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const role = formData.get('role') as string;

    const supabase = await createClient();

    // 1. Creăm contul oficial în Supabase Auth
    // Trimitem first_name și last_name în 'raw_user_meta_data', de unde le va prelua trigger-ul tău SQL
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName,
                role: role,
            }
        }
    });

    if (error) {
        console.error("Register error:", error.message);
        redirect(`/register?error=email_already_exists`);
    }

    // 2. Redirecționăm către pagina de succes
    redirect('/success');
}
