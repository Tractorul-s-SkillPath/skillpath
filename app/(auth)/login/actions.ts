/**
 * Login server action.
 *
 * Layer: ACTION — the thin edge between the form and the auth slice (§3).
 * Stories: SP-010, SP-014
 *
 * This used to parse the form and then redirect('/dashboard') without creating
 * a session. Middleware saw no cookie on /dashboard and sent the browser
 * straight back to /login, so signing in was an infinite bounce. The real
 * implementation — look the account up, create the signed session, redirect by
 * the role stored in the database — has always been in lib/auth/current-user.ts;
 * this file exists so the page keeps importing an action from its own slice.
 *
 * Read the header of lib/auth/current-user.ts before trusting this with
 * anything: sign-in is passwordless by team decision. The password field on the
 * form is collected and never verified.
 *
 * Not handled: middleware appends ?next= when it bounces you off a protected
 * page, and this ignores it — you land on your role's home instead of where you
 * were headed. That needs a hidden field on the form and a next-aware redirect.
 *
 * Test: tests/app/(auth)/login/actions.test.ts
 */

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

export async function loginAction(formData: FormData): Promise<void> {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const next = formData.get('next') as string | null;

    const supabase = await createClient();

    // 1. Apelăm metoda oficială Supabase Auth care validează parola și creează o sesiune securizată (token JWT)
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    // 2. Dacă emailul sau parola sunt greșite, returnăm utilizatorul la formular cu mesaj de eroare
    if (error) {
        console.error("Login error:", error.message);
        redirect(`/login?error=invalid`);
    }

    // 3. Dacă logarea are succes, trimitem utilizatorul la pagina dorită sau direct pe dashboard
    if (next) {
        redirect(next);
    } else {
        redirect('/dashboard');
    }
}